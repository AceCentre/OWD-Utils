import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

import SessionInput from "@components/SessionInput";
import SettingsButton from "@components/SettingsButton";
import SettingsPanel from "@components/SettingsPanel";
import TextDisplay from "@components/TextDisplay";
import messageTypes from "@utils/messageTypes.json";
import initialTextSettings from "@utils/initialTextSettings.json";
import WebRTCService from "@services/WebRTCService";

const Home = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [webrtcService, setWebrtcService] = useState(null);
  const [settings, setSettings] = useState(initialTextSettings);
  const [live, setLive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [text, setText] = useState("Waiting for messages...");
  const router = useRouter();
  const params = useLocalSearchParams();

  const websocketURL = process.env.NEXT_PUBLIC_WS_URL;

  useEffect(() => {
    if (params.sessionId) {
      setSessionId(params.sessionId as string);
    }
  }, [params]);

  useEffect(() => {
    if (sessionId && websocketURL) {
      const service = new WebRTCService((receivedMessage: string) => {
        const messageData = JSON.parse(receivedMessage);

        setLive(messageData.isLiveTyping);
        if (messageData.type === messageTypes.MESSAGE) {
          setText(messageData.content);
        }
      }, false);

      service.onChannelOpen(() => {
        setIsConnected(true);
        console.log("Data channel opened with sender.");
        service.sendMessage(
          JSON.stringify({ type: messageTypes.CONNECTED })
        );
        console.log("Sent CHANNEL_CONNECTED message to sender.");
      });

      service.connect(websocketURL, sessionId);
      setWebrtcService(service);

      return () => {
        service.disconnect();
        setIsConnected(false);
      };
    }
  }, [sessionId, websocketURL]);

  const handleConnect = () => {
    if (sessionId && websocketURL) {
      const service = new WebRTCService((receivedMessage: string) => {
        const messageData = JSON.parse(receivedMessage);

        setLive(messageData.isLiveTyping);
        if (messageData.type === messageTypes.MESSAGE) {
          setText(messageData.content);
        }
      }, false);

      service.onChannelOpen(() => {
        setIsConnected(true);
        service.sendMessage(
          JSON.stringify({ type: messageTypes.CONNECTED })
        );
      });

      service.connect(websocketURL, sessionId);
      setWebrtcService(service);
    } else {
      console.warn("Session ID and WebSocket URL are required to connect.");
    }
  };

  const handleSessionIdChange = (newSessionId: string) => {
    setSessionId(newSessionId);
  };

  return (
    <View style={styles.container}>
      {isConnected ? (
        <TextDisplay
          key={text}
          text={text}
          fontSize={settings.fontSize}
          fontFamily={settings.fontFamily}
          animationType={live ? "none" : settings.animationType}
          backgroundColor={settings.backgroundColor}
          color={settings.color}
          lines={settings.lines}
          speed={settings.speed}
        />
      ) : (
        <SessionInput
          sessionId={sessionId}
          handleSessionIdChange={handleSessionIdChange}
          handleConnect={handleConnect}
        />
      )}

      <SettingsButton
        isConnected={isConnected}
        setShowSettings={setShowSettings}
        sessionId={sessionId}
      />

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSettingsChange={setSettings}
          closeSettings={() => setShowSettings(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
  },
});

export default Home;