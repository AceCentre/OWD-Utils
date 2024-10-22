package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"golang.org/x/net/websocket"
)

var websocketURL = "wss://owd.acecentre.net/?EIO=4&transport=websocket"
var sessionID string
var connected = false

// Connect to the WebSocket server and join the session
func connectToServer(ws *websocket.Conn, sessionID string) error {
	fmt.Println("Joining session:", sessionID)
	err := websocket.Message.Send(ws, fmt.Sprintf(`42["joinSession", "%s"]`, sessionID))
	if err != nil {
		return err
	}
	connected = true
	return nil
}

// Send message to the display
func sendMessage(ws *websocket.Conn, sessionID, message string) error {
	fmt.Println("Sending message:", message)
	msgData := fmt.Sprintf(`42["signal", {"sessionId": "%s", "data": {"type": "message", "content": "%s"}}]`, sessionID, message)
	return websocket.Message.Send(ws, msgData)
}

func main() {
	// Get session ID input
	reader := bufio.NewReader(os.Stdin)
	fmt.Print("Enter the 3-word session ID: ")
	sessionID, _ = reader.ReadString('\n')
	sessionID = strings.TrimSpace(sessionID) // Remove trailing newline

	// Connect to WebSocket server
	ws, err := websocket.Dial(websocketURL, "", "https://owd.acecentre.net/")
	if err != nil {
		log.Fatal("WebSocket connection error:", err)
	}
	defer ws.Close()

	// Join the session
	err = connectToServer(ws, sessionID)
	if err != nil {
		log.Fatal("Failed to join session:", err)
	}

	// Start the message loop
	for {
		fmt.Print("Type a message to send: ")
		message, _ := reader.ReadString('\n')
		message = strings.TrimSpace(message) // Remove trailing newline

		if message != "" && connected {
			err := sendMessage(ws, sessionID, message)
			if err != nil {
				log.Println("Failed to send message:", err)
			}
		} else {
			fmt.Println("Message is empty or not connected.")
		}

		// Simulate typing (optional)
		typingData := fmt.Sprintf(`42["signal", {"sessionId": "%s", "data": {"type": "typing", "content": "Writing..."}}]`, sessionID)
		websocket.Message.Send(ws, typingData)

		time.Sleep(1 * time.Second) // Mimic some delay for user typing
	}
}
