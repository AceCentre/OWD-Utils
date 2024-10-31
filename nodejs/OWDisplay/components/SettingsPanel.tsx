import React, { useState } from "react";
import { View, Text, TextInput, Button, Modal, StyleSheet, TouchableOpacity, Picker, ScrollView } from "react-native";
import TextDisplay from "./TextDisplay";

type SettingsPanelProps = {
    onSettingsChange: (settings: any) => void;
    closeSettings: () => void;
    settings: {
        animationType: string;
        backgroundColor: string;
        color: string;
        fontSize: number;
        lines: number;
        speed: number;
        fontFamily: string;
    };
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onSettingsChange, closeSettings, settings }) => {
    const [activeTab, setActiveTab] = useState("display");
    const [animationType, setAnimationType] = useState(settings.animationType);
    const [backgroundColor, setBackgroundColor] = useState(settings.backgroundColor);
    const [color, setColor] = useState(settings.color);
    const [fontSize, setFontSize] = useState(settings.fontSize);
    const [lines, setLines] = useState(settings.lines);
    const [speed, setSpeed] = useState(settings.speed);
    const [fontFamily, setFontFamily] = useState(settings.fontFamily || "Arial");
    const [notificationStatus, setNotificationStatus] = useState(
        typeof Notification !== "undefined" ? Notification.permission : "unsupported"
    );

    const handleEnableNotifications = () => {
        if (typeof Notification === "undefined") {
            setNotificationStatus("unsupported");
            console.warn("Notifications API not supported on this platform.");
            return;
        }

        if (Notification.permission === "default") {
            Notification.requestPermission()
                .then((permission) => {
                    setNotificationStatus(permission);
                    if (permission === "granted") {
                        console.log("Notifications enabled.");
                    } else if (permission === "denied") {
                        console.log("Notifications denied.");
                    }
                })
                .catch((error) => {
                    console.error("Notification permission request failed:", error);
                });
        }
    };

    const handleUpdate = () => {
        onSettingsChange({
            animationType,
            backgroundColor,
            color,
            fontSize,
            lines,
            speed,
            fontFamily,
        });
        closeSettings();
    };

    return (
        <Modal visible={true} animationType="slide" onRequestClose={closeSettings}>
            <View style={styles.modalContainer}>
                <Text style={styles.title}>Settings</Text>
                <ScrollView>
                    {activeTab === "display" && (
                        <View style={styles.formContainer}>
                            <Text style={styles.label}>Font Size</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={fontSize.toString()}
                                onChangeText={(value) => setFontSize(Number(value))}
                            />

                            <Text style={styles.label}>Font Style</Text>
                            <Picker selectedValue={fontFamily} onValueChange={(itemValue) => setFontFamily(itemValue)}>
                                <Picker.Item label="Arial (Default)" value="Arial" />
                                <Picker.Item label="Handwriting (Dancing Script)" value="Dancing Script" />
                                <Picker.Item label="Bold Impact (Oswald)" value="Oswald" />
                                <Picker.Item label="Marker (Permanent Marker)" value="Permanent Marker" />
                            </Picker>

                            <Text style={styles.label}>Text Color</Text>
                            <TextInput
                                style={styles.input}
                                value={color}
                                onChangeText={(value) => setColor(value)}
                                placeholder="Enter hex color"
                            />

                            <Text style={styles.label}>Background Color</Text>
                            <TextInput
                                style={styles.input}
                                value={backgroundColor}
                                onChangeText={(value) => setBackgroundColor(value)}
                                placeholder="Enter hex color"
                            />
                        </View>
                    )}

                    {activeTab === "animation" && (
                        <View style={styles.formContainer}>
                            <Text style={styles.label}>Lines</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={lines.toString()}
                                onChangeText={(value) => setLines(Number(value))}
                            />

                            <Text style={styles.label}>Speed</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={speed.toString()}
                                onChangeText={(value) => setSpeed(Number(value))}
                            />

                            <Text style={styles.label}>Animation Type</Text>
                            <Picker selectedValue={animationType} onValueChange={(itemValue) => setAnimationType(itemValue)}>
                                <Picker.Item label="None" value="none" />
                                <Picker.Item label="Typing" value="typing" />
                                <Picker.Item label="Scrolling" value="scroll" />
                                <Picker.Item label="Fade In" value="fade-in" />
                                <Picker.Item label="Slide In" value="slide-in" />
                            </Picker>
                        </View>
                    )}

                    {activeTab === "usersettings" && (
                        <View style={styles.formContainer}>
                            <Button
                                title={
                                    notificationStatus === "granted"
                                        ? "Notifications are enabled"
                                        : notificationStatus === "denied"
                                            ? "Enable notifications in browser settings"
                                            : "Enable Notifications"
                                }
                                onPress={handleEnableNotifications}
                                disabled={notificationStatus === "granted" || notificationStatus === "denied"}
                            />
                        </View>
                    )}
                </ScrollView>
                <View style={styles.buttonContainer}>
                    <Button title="Apply" onPress={handleUpdate} />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        padding: 20,
        backgroundColor: "#fff",
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 20,
    },
    formContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        marginBottom: 5,
    },
    input: {
        height: 40,
        borderColor: "gray",
        borderWidth: 1,
        marginBottom: 10,
        paddingLeft: 10,
        borderRadius: 5,
    },
    buttonContainer: {
        marginTop: 20,
    },
});

export default SettingsPanel;