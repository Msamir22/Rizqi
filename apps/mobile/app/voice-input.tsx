import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { detectLanguage } from "@astik/logic";
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Defs,
  Path,
  Stop,
  LinearGradient as SvgGradient,
} from "react-native-svg";
import { AITransaction, parseVoiceWithAI } from "../utils/api";

const { width } = Dimensions.get("window");

// --- Components ---

// 1. Animated Waveform (Mock Visual)
const Waveform = ({
  isListening,
  mode,
}: {
  isListening: boolean;
  mode: string;
}): React.ReactNode => {
  const isDark = mode === "dark";
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.timing(phase, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      phase.setValue(0);
    }
  }, [isListening]);

  return (
    <View className="h-[60px] w-full items-center justify-center overflow-hidden">
      <Svg width={width - 80} height="50" viewBox="0 0 300 50">
        <Defs>
          <SvgGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#3B82F6" stopOpacity="0.2" />
            <Stop offset="0.5" stopColor="#2DD4BF" stopOpacity="1" />
            <Stop offset="1" stopColor="#3B82F6" stopOpacity="0.2" />
          </SvgGradient>
        </Defs>
        <Path
          d="M0,25 Q30,5 50,25 T100,25 T150,25 T200,25 T250,25 T300,25"
          fill="none"
          stroke={
            isListening ? "url(#waveGrad)" : isDark ? "#334155" : "#E2E8F0"
          }
          strokeWidth={isListening ? "4" : "2"}
        />
        {isListening && (
          <Path
            d="M0,25 Q40,45 80,25 T160,25 T240,25 T300,25"
            fill="none"
            stroke="url(#waveGrad)"
            strokeWidth="2"
            strokeOpacity="0.5"
          />
        )}
      </Svg>
    </View>
  );
};

// 2. Ripple Mic Button
const MicButton = ({
  isListening,
  onPress,
}: {
  isListening: boolean;
  onPress: () => void;
}): React.ReactNode => {
  const { mode } = useTheme();
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const isDark = mode === "dark";

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulse1, {
              toValue: 1.5,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(pulse1, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(500),
            Animated.timing(pulse2, {
              toValue: 1.5,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(pulse2, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    } else {
      pulse1.setValue(1);
      pulse2.setValue(1);
    }
  }, [isListening]);

  return (
    <View className="h-40 w-40 items-center justify-center">
      {/* Ripples */}
      {isListening && (
        <>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: 80,
                backgroundColor: isDark
                  ? "rgba(16, 185, 129, 0.2)"
                  : "rgba(16, 185, 129, 0.1)",
                transform: [{ scale: pulse1 }],
                opacity: pulse1.interpolate({
                  inputRange: [1, 1.5],
                  outputRange: [1, 0],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: 80,
                backgroundColor: isDark
                  ? "rgba(16, 185, 129, 0.2)"
                  : "rgba(16, 185, 129, 0.1)",
                transform: [{ scale: pulse2 }],
                opacity: pulse2.interpolate({
                  inputRange: [1, 1.5],
                  outputRange: [1, 0],
                }),
              },
            ]}
          />
        </>
      )}

      {/* Main Button */}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        className="h-24 w-24 rounded-full shadow-lg"
        style={{
          shadowColor: palette.nileGreen[500],
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: isListening ? 0.5 : 0.2,
          elevation: 10,
        }}
      >
        <LinearGradient
          colors={
            isListening
              ? [palette.nileGreen[500], palette.nileGreen[700]]
              : isDark
                ? [palette.slate[700], palette.slate[800]]
                : [palette.slate[100], palette.slate[200]]
          }
          className="flex-1 items-center justify-center rounded-full border-4"
          style={{
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "#FFFFFF",
          }}
        >
          <FontAwesome5
            name="microphone"
            size={36}
            color={
              isListening
                ? "#FFF"
                : isDark
                  ? palette.slate[400]
                  : palette.slate[500]
            }
          />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

export default function VoiceInput(): React.ReactNode {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode } = useTheme();
  const isDark = mode === "dark";

  // --- Logic State ---
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [detectedLang, setDetectedLang] = useState<"ar" | "en">("en");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<
    AITransaction[] | null
  >(null);
  // const [isSaving, setIsSaving] = useState(false);

  // --- Speech Events ---
  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
    setTranscript("");
    setParsedTransactions(null);
    setIsAnalyzing(false);
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (event.results && event.results.length > 0) {
      const transcriptText = event.results[0].transcript;
      setTranscript(transcriptText);
      const lang = detectLanguage(transcriptText);
      setDetectedLang(lang);
      if (event.isFinal) {
        setIsListening(false);
        handleAnalyze(transcriptText, lang);
      }
    }
  });

  // --- Handlers ---
  const handleAnalyze = async (text: string, lang: string): Promise<void> => {
    setIsAnalyzing(true);
    try {
      const result = await parseVoiceWithAI(text, lang);
      setParsedTransactions(result.transactions);
    } catch {
      Alert.alert("Analysis Failed", "Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startListening = async (): Promise<void> => {
    if (!hasPermission) {
      const result =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) return;
      setHasPermission(true);
    }
    try {
      ExpoSpeechRecognitionModule.start({
        lang: detectedLang === "ar" ? "ar-EG" : "en-US",
        interimResults: true,
        maxAlternatives: 1,
      });
    } catch {
      Alert.alert(
        "Permission Denied",
        "Please grant permission to use the microphone."
      );
    }
  };

  const stopListening = (): void => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      Alert.alert(
        "Permission Denied",
        "Please grant permission to use the microphone."
      );
    }
  };

  const handleMicPress = async (): Promise<void> =>
    isListening ? stopListening() : await startListening();

  // const handleConfirm = async (): Promise<void> => {
  //   if (!parsedTransactions || isSaving) return;
  //   setIsSaving(true);
  //   try {
  //     const defaultAccount = await getOrCreateDefaultAccount();
  //     for (const tx of parsedTransactions) {
  //       const isExpense = tx.type === "expense";
  //       await createTransaction({
  //         amount: tx.amount,
  //         currency: tx.currency,
  //         categoryId: tx.category?.toLowerCase() || "other",
  //         note: tx.description,
  //         type: isExpense ? "EXPENSE" : "INCOME",
  //         accountId: defaultAccount.id,
  //         merchant: isExpense ? tx.description : undefined,
  //       });
  //     }
  //     Alert.alert("Saved!", "Transactions added successfully.", [
  //       { text: "OK", onPress: () => router.back() },
  //     ]);
  //   } catch (e) {
  //     console.error("Save error:", e);
  //     Alert.alert("Error", "Failed to save.");
  //   } finally {
  //     setIsSaving(false);
  //   }
  // };

  const deleteTransaction = (index: number): void => {
    if (!parsedTransactions) return;
    const updated = parsedTransactions.filter((_, i) => i !== index);
    setParsedTransactions(updated);
    if (updated.length === 0) setParsedTransactions(null);
  };

  return (
    <View className="flex-1">
      {/* Background for Dark Mode */}
      {isDark && (
        <LinearGradient
          colors={["#0F172A", "#1E293B"]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View
        className="flex-row items-center justify-between px-6 pb-6"
        style={{ paddingTop: insets.top + 20 }}
      >
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Ionicons
            name="close"
            size={28}
            color={isDark ? "#FFF" : palette.slate[900]}
          />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-text-primary dark:text-white">
          Voice Input
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
      >
        {/* Mic Section */}
        <View className="mb-8 mt-6 items-center">
          <MicButton isListening={isListening} onPress={handleMicPress} />
          <Text className="mt-6 text-base text-text-secondary dark:text-white/60">
            {isListening ? "Listening..." : "Tap to speak"}
          </Text>

          {/* Waveform Visualization */}
          <View
            className="mt-4 w-full"
            style={{ opacity: isListening ? 1 : 0.3 }}
          >
            <Waveform isListening={isListening} mode={mode} />
          </View>
        </View>

        {/* Transcript Box */}
        {transcript ? (
          <View className="mb-6 rounded-[20px] border border-border bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <Text className="mb-1.5 text-[13px] text-text-secondary dark:text-text-muted">
              I heard:
            </Text>
            <Text
              className="font-[System] text-lg font-semibold leading-7 text-text-primary dark:text-white"
              style={{ textAlign: detectedLang === "ar" ? "right" : "left" }}
            >
              {transcript}
            </Text>
          </View>
        ) : null}

        {/* Detected Transactions List */}
        {parsedTransactions && (
          <View>
            <Text className="mb-3 text-base font-semibold text-text-primary dark:text-white">
              Detected Transactions
            </Text>
            {parsedTransactions.map((tx, idx) => (
              <View
                key={idx}
                className="mb-3 flex-row items-center rounded-2xl border border-border bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none"
              >
                {/* Icon */}
                <View
                  className="mr-4 h-12 w-12 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor:
                      tx.type === "income"
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(239, 68, 68, 0.15)",
                  }}
                >
                  <FontAwesome5
                    name={
                      tx.type === "income" ? "money-bill-wave" : "shopping-cart"
                    }
                    size={20}
                    color={
                      tx.type === "income"
                        ? palette.nileGreen[500]
                        : palette.red[500]
                    }
                  />
                </View>

                {/* Content */}
                <View className="flex-1">
                  <Text className="mb-1 text-base font-semibold text-text-primary dark:text-white">
                    {tx.description}
                  </Text>
                  <Text className="text-lg font-bold text-text-primary dark:text-white">
                    ${tx.amount.toFixed(2)}
                  </Text>
                </View>

                {/* Actions */}
                <View className="flex-row gap-3">
                  <TouchableOpacity>
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={22}
                      color={isDark ? palette.slate[400] : palette.slate[500]}
                    />
                    <Text className="mt-0.5 text-center text-[10px] text-text-secondary dark:text-text-muted">
                      EDIT
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteTransaction(idx)}>
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={22}
                      color={palette.red[500]}
                    />
                    <Text
                      className="mt-0.5 text-center text-[10px]"
                      style={{ color: palette.red[500] }}
                    >
                      DELETE
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      {parsedTransactions && (
        <View
          className="absolute bottom-0 left-0 right-0 flex-row gap-4 border-t border-border bg-background px-6 pt-5 dark:border-white/10 dark:bg-background-dark"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <TouchableOpacity
            onPress={() => {
              setParsedTransactions(null);
              setTranscript("");
            }}
            className="flex-1 items-center justify-center rounded-3xl border border-action py-4"
          >
            <Text className="text-base font-semibold text-action">
              Try Again
            </Text>
          </TouchableOpacity>

          {/* <TouchableOpacity
            onPress={handleConfirm}
            disabled={isSaving}
            className="flex-1 overflow-hidden rounded-3xl"
          >
            <LinearGradient
              colors={[palette.nileGreen[500], palette.nileGreen[700]]}
              className="flex-1 items-center justify-center py-4"
            >
              {isSaving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text className="text-base font-bold text-white">
                  Confirm All
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity> */}
        </View>
      )}

      {/* Analyzing Overlay */}
      {isAnalyzing && (
        <View className="absolute inset-0 items-center justify-center bg-black/60">
          <View className="rounded-3xl bg-surface p-8 dark:bg-surface-dark">
            <ActivityIndicator size="large" color={palette.nileGreen[500]} />
            <Text className="mt-4 font-semibold text-text-primary dark:text-white">
              Analyzing Voice...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
