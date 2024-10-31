import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

type SettingButtonProps = {
    setShowSettings: (show: boolean) => void;
    isConnected: boolean;
    sessionId: string;
};

const SettingButton: React.FC<SettingButtonProps> = ({ setShowSettings, isConnected, sessionId }) => (
    <View style={styles.container}>
        <TouchableOpacity style={styles.button} onPress={() => setShowSettings(true)}>
            <Text style={styles.buttonText}>⚙️ Settings</Text>
        </TouchableOpacity>
        <Text style={[styles.sessionId, { color: isConnected ? "green" : "red" }]}>
            {isConnected ? "●" : "●"} Session ID: {sessionId}
        </Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flexDirection: "column",
        alignItems: "center",
        marginVertical: 10,
    },
    button: {
        padding: 10,
        backgroundColor: "#e0e0e0",
        borderRadius: 5,
        alignItems: "center",
    },
    buttonText: {
        fontSize: 16,
        fontWeight: "500",
    },
    sessionId: {
        marginTop: 5,
        fontSize: 14,
        fontWeight: "500",
    },
});

export default SettingButton;