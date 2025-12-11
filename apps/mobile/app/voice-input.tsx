import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Animated,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

// Import from shared packages
import { detectLanguage } from "@astik/logic";
import { colors } from "@astik/ui";

// Import API and helper
import { parseVoiceWithAI, AITransaction } from "../utils/api";
import {
  createTransaction,
  getOrCreateDefaultAccount,
} from "../utils/transactions";

export default function VoiceInput() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [detectedLang, setDetectedLang] = useState<"ar" | "en">("en");
  const [manualLang, setManualLang] = useState<"en-US" | "ar-EG">("en-US"); // Default manual lang
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // AI Parsing State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<
    AITransaction[] | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

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

      // Auto-detect lang for UI
      const lang = detectLanguage(transcriptText);
      setDetectedLang(lang);

      // If final, trigger AI analysis
      if (event.isFinal) {
        setIsListening(false);
        handleAnalyze(transcriptText, lang);
      }
    }
  });

  useSpeechRecognitionEvent("languagedetection", (event) => {
    if (event.confidence >= 0.6) {
      setDetectedLang(event.detectedLanguage.startsWith("ar") ? "ar" : "en");
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    setIsListening(false);
    if (event.error === "no-speech") {
      Alert.alert(
        detectedLang === "ar" ? "لم يتم اكتشاف صوت" : "No Speech Detected",
        detectedLang === "ar" ? "حاول مرة أخرى" : "Please try speaking again."
      );
    }
  });

  // --- Actions ---

  const handleAnalyze = async (text: string, lang: string) => {
    console.log(`DEBUG: Analyzing text: "${text}" with lang: ${lang}`);
    setIsAnalyzing(true);
    try {
      const result = await parseVoiceWithAI(text, lang);
      console.log("DEBUG: Parsed Result:", JSON.stringify(result, null, 2));
      setParsedTransactions(result.transactions);
    } catch (error) {
      console.error(error);
      Alert.alert(
        detectedLang === "ar" ? "فشل التحليل" : "Analysis Failed",
        detectedLang === "ar"
          ? "تأكد من اتصالك بالإنترنت وحاول مرة أخرى"
          : "Check your internet connection and try again."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsedTransactions || parsedTransactions.length === 0) return;

    setIsSaving(true);
    try {
      const defaultAccount = await getOrCreateDefaultAccount();

      // Save all transactions
      for (const tx of parsedTransactions) {
        const targetAccountId = defaultAccount.id;

        await createTransaction({
          amount: tx.amount,
          currency: tx.currency,
          category: tx.category || undefined,
          note: tx.description,
          isExpense: tx.type === "expense" || tx.type === "loan",
          accountId: targetAccountId,
          merchant: tx.type === "expense" ? tx.description : undefined,
        });
      }

      Alert.alert(
        detectedLang === "ar" ? "تم الحفظ!" : "Saved!",
        detectedLang === "ar"
          ? `تم حفظ ${parsedTransactions.length} عملية`
          : `Saved ${parsedTransactions.length} transactions.`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert("Error", "Failed to save transactions.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetry = () => {
    setTranscript("");
    setParsedTransactions(null);
    startListening();
  };

  const startListening = async () => {
    try {
      if (!hasPermission) {
        const result =
          await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!result.granted) return;
        setHasPermission(true);
      }

      // Update detected lang UI based on manual selection for immediate feedback
      setDetectedLang(manualLang === "ar-EG" ? "ar" : "en");

      await ExpoSpeechRecognitionModule.start({
        lang: manualLang, // Use the manually selected language
        interimResults: true,
        maxAlternatives: 1,
        // We still keep Android options just in case, but 'lang' takes precedence for the primary model
        androidIntentOptions:
          Platform.OS === "android"
            ? {
                EXTRA_ENABLE_LANGUAGE_SWITCH: "balanced",
                EXTRA_ENABLE_LANGUAGE_DETECTION: true,
                EXTRA_LANGUAGE_DETECTION_ALLOWED_LANGUAGES: ["ar-EG", "en-US"],
              }
            : undefined,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to start recognition");
    }
  };

  const stopListening = async () => {
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (e) {}
  };

  const handleMicPress = () => {
    if (isListening) stopListening();
    else startListening();
  };

  const toggleLanguage = () => {
    if (isListening) stopListening();
    const newLang = manualLang === "en-US" ? "ar-EG" : "en-US";
    setManualLang(newLang);
    setDetectedLang(newLang === "ar-EG" ? "ar" : "en");
  };

  // Animation Pulse
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
      Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ).start();
    } else {
      pulseAnim.setValue(1);
      waveAnim.setValue(0);
    }
  }, [isListening]);

  // Text Labels
  const isArabic = detectedLang === "ar";
  const labels = {
    title: "Voice Input",
    listening: isArabic ? "جاري الاستماع..." : "Listening...",
    analyzing: isArabic
      ? "جاري التحليل بالذكاء الاصطناعي..."
      : "Analyzing with AI...",
    tapToStart: isArabic ? "اضغط للبدء" : "Tap to start",
    speakNaturally: isArabic
      ? "تحدث - سأفهم ٤ عمليات في جملة واحدة"
      : "Speak naturally - multiple actions supported",
    iHeard: isArabic ? "سمعت:" : "I heard:",
    preview: isArabic ? "العمليات المكتشفة" : "Detected Transactions",
    confirm: isSaving
      ? isArabic
        ? "جاري الحفظ..."
        : "Saving..."
      : isArabic
        ? "تأكيد الكل"
        : "Confirm All",
    tryAgain: isArabic ? "حاول مرة أخرى" : "Try Again",
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary.main }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.primary.main}
      />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={colors.text.inverse} />
        </TouchableOpacity>
        <Text
          style={{
            color: colors.text.inverse,
            fontSize: 18,
            fontWeight: "600",
          }}
        >
          {labels.title}
        </Text>
        <TouchableOpacity
          onPress={toggleLanguage}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.2)",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
          }}
        >
          <Text
            style={{
              color: colors.text.inverse,
              fontWeight: "bold",
              fontSize: 14,
            }}
          >
            {manualLang === "ar-EG" ? "AR" : "EN"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, padding: 20 }}>
        {/* State: LISTENING or IDLE */}
        {!parsedTransactions && !isAnalyzing && (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            {/* Waveform */}
            {isListening && (
              <View
                style={{
                  height: 40,
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <Text style={{ color: "rgba(255,255,255,0.8)" }}>•••</Text>
              </View>
            )}

            <Animated.View
              style={{ transform: [{ scale: isListening ? pulseAnim : 1 }] }}
            >
              <TouchableOpacity
                onPress={handleMicPress}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  backgroundColor: isListening
                    ? colors.action.main
                    : "rgba(255,255,255,0.2)",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 4,
                  borderColor: colors.text.inverse,
                }}
              >
                <Ionicons
                  name={isListening ? "mic" : "mic-off"}
                  size={40}
                  color={colors.text.inverse}
                />
              </TouchableOpacity>
            </Animated.View>

            <Text
              style={{
                color: "white",
                marginTop: 24,
                fontSize: 18,
                fontWeight: "500",
              }}
            >
              {isListening ? labels.listening : labels.tapToStart}
            </Text>

            {!isListening && !transcript && (
              <Text style={{ color: "rgba(255,255,255,0.6)", marginTop: 8 }}>
                {labels.speakNaturally}
              </Text>
            )}

            {transcript ? (
              <View
                style={{
                  marginTop: 40,
                  width: "100%",
                  padding: 16,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  {labels.iHeard}
                </Text>
                <Text
                  style={{
                    color: "white",
                    fontSize: 18,
                    textAlign: isArabic ? "right" : "left",
                  }}
                >
                  "{transcript}"
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* State: ANALYZING */}
        {isAnalyzing && (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator size="large" color={colors.action.main} />
            <Text style={{ color: "white", marginTop: 16, fontSize: 16 }}>
              {labels.analyzing}
            </Text>
          </View>
        )}

        {/* State: REVIEW TRANSACTIONS */}
        {parsedTransactions && (
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.text.inverse,
                fontSize: 20,
                fontWeight: "bold",
                marginBottom: 16,
              }}
            >
              {labels.preview}
            </Text>

            <ScrollView style={{ flex: 1 }}>
              {parsedTransactions.map((tx, idx) => (
                <View
                  key={idx}
                  style={{
                    backgroundColor: colors.text.inverse,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: colors.text.primary,
                      }}
                    >
                      {tx.description}
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "bold",
                        color:
                          tx.type === "income" || tx.type === "borrow"
                            ? colors.action.main
                            : colors.expense.main,
                      }}
                    >
                      {tx.type === "income" || tx.type === "borrow" ? "+" : "-"}{" "}
                      {tx.amount} {tx.currency}
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{ fontSize: 14, color: colors.text.secondary }}
                    >
                      {tx.category || "Uncategorized"} • {tx.type}
                    </Text>
                    {tx.account && (
                      <Text
                        style={{
                          fontSize: 14,
                          color: colors.primary.main,
                          fontWeight: "500",
                        }}
                      >
                        {tx.account}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View
              style={{
                flexDirection: "row",
                gap: 12,
                marginTop: 16,
                paddingBottom: insets.bottom + 10,
              }}
            >
              <TouchableOpacity
                onPress={handleRetry}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "white",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "600" }}>
                  {labels.tryAgain}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirm}
                disabled={isSaving}
                style={{
                  flex: 2,
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: colors.action.main,
                  alignItems: "center",
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  {labels.confirm}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
