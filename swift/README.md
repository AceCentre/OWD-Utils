	1.	Create an instance of WebRTCConnection.
	2.	Call startSession() to initiate a session and get a session ID.
	3.	Use sendMessage(_:) to send text messages to connected peers.
	4.	Call closeConnection() when disconnecting or ending the session.

Required Libraries

	•	WebRTC (can be installed using CocoaPods or Swift Package Manager).
	•	Starscream (a WebSocket library for Swift, also available via CocoaPods or SPM).
