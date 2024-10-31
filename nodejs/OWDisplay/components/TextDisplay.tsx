import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";

type TextDisplayProps = {
    animationType: string;
    backgroundColor: string;
    color: string;
    fontSize: number;
    fontFamily: string;
    lines: number;
    speed: number;
    text: string;
};

const TextDisplay: React.FC<TextDisplayProps> = ({
    animationType,
    backgroundColor,
    color,
    fontSize = 72,
    fontFamily = "Arial",
    lines,
    speed,
    text,
}) => {
    const lineHeight = fontSize * 1.4;
    const containerHeight = lineHeight * lines;

    const animatedValue = useRef(new Animated.Value(0)).current;
    const [typedText, setTypedText] = useState("");

    // Typing animation effect
    useEffect(() => {
        if (animationType === "typing") {
            setTypedText("");
            let index = 0;
            const interval = setInterval(() => {
                if (index < text.length) {
                    setTypedText((prev) => prev + text[index]);
                    index++;
                } else {
                    clearInterval(interval);
                }
            }, speed * 50); // Adjust speed as needed

            return () => clearInterval(interval);
        }
    }, [text, speed, animationType]);

    // Fade-in and slide-in animations
    useEffect(() => {
        if (animationType === "fade-in" || animationType === "slide-in") {
            Animated.timing(animatedValue, {
                toValue: 1,
                duration: speed * 1000,
                useNativeDriver: true,
            }).start();
        }
    }, [text, speed, animationType]);

    const containerStyles = {
        backgroundColor,
        color,
        fontSize,
        lineHeight,
        height: containerHeight,
        fontFamily,
    };

    const getAnimationContent = () => {
        switch (animationType) {
            case "scroll":
                return (
                    <Animated.View style={[styles.scrollContainer, { height: containerHeight }]}>
                        <Animated.Text
                            style={[
                                { fontSize, color, lineHeight, fontFamily },
                                {
                                    transform: [
                                        {
                                            translateY: animatedValue.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [containerHeight, -containerHeight],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        >
                            {text}
                        </Animated.Text>
                    </Animated.View>
                );
            case "typing":
                return <Text style={[styles.text, { color, fontSize, fontFamily }]}>{typedText}</Text>;
            case "fade-in":
                return (
                    <Animated.Text style={[styles.text, { opacity: animatedValue, color, fontSize, fontFamily }]}>
                        {text}
                    </Animated.Text>
                );
            case "slide-in":
                return (
                    <Animated.Text
                        style={[
                            styles.text,
                            {
                                transform: [
                                    {
                                        translateX: animatedValue.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [-200, 0], // Slide in from the left
                                        }),
                                    },
                                ],
                                color,
                                fontSize,
                                fontFamily,
                            },
                        ]}
                    >
                        {text}
                    </Animated.Text>
                );
            default:
                return <Text style={[styles.text, { color, fontSize, fontFamily }]}>{text}</Text>;
        }
    };

    return <View style={[styles.container, containerStyles]}>{getAnimationContent()}</View>;
};

const styles = StyleSheet.create({
    container: {
        justifyContent: "center",
        alignItems: "center",
        padding: 10,
    },
    text: {
        textAlign: "center",
    },
    scrollContainer: {
        overflow: "hidden",
    },
});

export default TextDisplay;