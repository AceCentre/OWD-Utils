import Foundation
import WebRTC
import Starscream

class WebRTCConnection: NSObject, WebSocketDelegate {
    private var peerConnections: [String: RTCPeerConnection] = [:]
    private var dataChannels: [String: RTCDataChannel] = [:]
    private var webSocket: WebSocket?
    private var sessionId: String
    private let serverURL = URL(string: "wss://owd.acecentre.net")!
    
    var onConnected: (() -> Void)?
    var onDisconnected: (() -> Void)?
    var onSessionIdCreated: ((String) -> Void)?
    
    override init() {
        self.sessionId = WebRTCConnection.generateSessionId()
        super.init()
        setupWebSocket()
    }
    
    static func generateSessionId() -> String {
        let words = ["blue", "red", "green", "fast", "swift", "smart"]  // Replace with actual word generation if needed
        let randomWords = words.shuffled().prefix(3)
        return randomWords.joined(separator: "-")
    }
    
    func startSession() {
        onSessionIdCreated?(self.sessionId)
        print("Session ID: \(self.sessionId)")
    }
    
    private func setupWebSocket() {
        var request = URLRequest(url: serverURL)
        request.timeoutInterval = 5
        webSocket = WebSocket(request: request)
        webSocket?.delegate = self
        webSocket?.connect()
    }
    
    func sendMessage(_ text: String) {
        let message = ["type": "MESSAGE", "content": text]
        guard let data = try? JSONSerialization.data(withJSONObject: message, options: []) else { return }
        
        dataChannels.values.forEach { channel in
            if channel.readyState == .open {
                channel.sendData(RTCDataBuffer(data: data, isBinary: false))
            }
        }
    }
    
    func closeConnection() {
        dataChannels.values.forEach { $0.close() }
        peerConnections.values.forEach { $0.close() }
        dataChannels.removeAll()
        peerConnections.removeAll()
        webSocket?.disconnect()
        onDisconnected?()
        print("WebRTC connection closed.")
    }
    
    // MARK: WebSocketDelegate Methods
    func didReceive(event: WebSocketEvent, client: WebSocket) {
        switch event {
        case .connected:
            print("WebSocket connected")
            onConnected?()
            webSocket?.write(string: "{\"type\":\"joinSession\",\"sessionId\":\"\(sessionId)\"}")
            
        case .disconnected(let reason, _):
            print("WebSocket disconnected: \(reason)")
            onDisconnected?()
            
        case .text(let text):
            handleSignalMessage(text)
            
        default:
            break
        }
    }
    
    private func handleSignalMessage(_ message: String) {
        guard let data = message.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let peerId = json["peerId"] as? String,
              let signalData = json["data"] as? [String: Any] else { return }
        
        if let type = signalData["type"] as? String {
            switch type {
            case "offer":
                handleOffer(from: peerId, signalData)
            case "answer":
                handleAnswer(from: peerId, signalData)
            case "ice-candidate":
                handleIceCandidate(from: peerId, signalData)
            default:
                break
            }
        }
    }
    
    private func handleOffer(from peerId: String, _ data: [String: Any]) {
        let config = RTCConfiguration()
        config.iceServers = [RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"])] // Update with your ICE servers
        let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        
        let peerConnection = RTCPeerConnectionFactory().peerConnection(with: config, constraints: constraints, delegate: nil)
        peerConnections[peerId] = peerConnection
        
        let dataChannelConfig = RTCDataChannelConfiguration()
        let dataChannel = peerConnection.dataChannel(forLabel: "messaging", configuration: dataChannelConfig)
        dataChannel?.delegate = self
        dataChannels[peerId] = dataChannel
        
        if let sdp = data["offer"] as? String {
            let remoteOffer = RTCSessionDescription(type: .offer, sdp: sdp)
            peerConnection.setRemoteDescription(remoteOffer) { error in
                if let error = error {
                    print("Failed to set remote offer: \(error)")
                    return
                }
                peerConnection.answer(for: constraints) { answer, error in
                    if let answer = answer {
                        peerConnection.setLocalDescription(answer) { error in
                            if error == nil {
                                self.sendSignal(peerId: peerId, data: ["type": "answer", "answer": answer.sdp])
                            }
                        }
                    }
                }
            }
        }
    }
    
    private func handleAnswer(from peerId: String, _ data: [String: Any]) {
        guard let sdp = data["answer"] as? String,
              let peerConnection = peerConnections[peerId] else { return }
        let remoteAnswer = RTCSessionDescription(type: .answer, sdp: sdp)
        peerConnection.setRemoteDescription(remoteAnswer, completionHandler: nil)
    }
    
    private func handleIceCandidate(from peerId: String, _ data: [String: Any]) {
        guard let candidateString = data["candidate"] as? String,
              let peerConnection = peerConnections[peerId] else { return }
        let candidate = RTCIceCandidate(sdp: candidateString, sdpMLineIndex: 0, sdpMid: nil)
        peerConnection.add(candidate)
    }
    
    private func sendSignal(peerId: String, data: [String: Any]) {
        let message = ["sessionId": sessionId, "peerId": peerId, "data": data]
        guard let messageData = try? JSONSerialization.data(withJSONObject: message, options: []) else { return }
        webSocket?.write(data: messageData)
    }
}