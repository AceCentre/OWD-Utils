import React from "react";
import { View, TextInput, Button, StyleSheet } from "react-native";

type SessionInputProps = {
    sessionId: string;
    handleSessionIdChange: (event: string) => void;
    handleConnect: () => void;
};

const SessionInput: React.FC<SessionInputProps> = ({ sessionId, handleSessionIdChange, handleConnect }) => (
    <View style={styles.container}>
        <TextInput
            style={styles.input}
            placeholder="Enter the 3-word session ID"
            value={sessionId}
            onChangeText={handleSessionIdChange}
        />
        <Button
            title="Connect"
            onPress={handleConnect}
            disabled={!sessionId}
            color="#007bff" // primary color like "type=primary" in AntDesign
        />
    </View>
);

const styles = StyleSheet.create({
    container: {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
    },
    input: {
        height: 40,
        borderColor: "#ccc",
        borderWidth: 1,
        padding: 10,
        marginBottom: 10,
        width: "80%",
        borderRadius: 4,
    },
});

export default SessionInput;