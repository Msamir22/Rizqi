/**
 * SmsPermissionPrompt Component
 *
 * Premium modal/bottom sheet that explains SMS reading benefits
 * and requests READ_SMS permission from the user.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component
 * - SOLID: Single Responsibility — only handles the permission
 *   prompt UI, delegates state management to hooks
 *
 * @module SmsPermissionPrompt
 */

import React, { useCallback } from "react";
import {
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "@/constants/colors";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SmsPermissionPromptProps {
  /** Whether the modal is visible */
  readonly visible: boolean;
  /** Callback when user taps "Allow" and permission is granted */
  readonly onPermissionGranted: () => void;
  /** Callback when user taps "Not Now" or permission is denied */
  readonly onDismiss: () => void;
  /** Function to request the permission (from useSmsPermission) */
  readonly requestPermission: () => Promise<
    "undetermined" | "granted" | "denied" | "blocked"
  >;
}

// ---------------------------------------------------------------------------
// Feature Bullet
// ---------------------------------------------------------------------------

interface FeatureBulletProps {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly title: string;
  readonly description: string;
  readonly delay: number;
}

function FeatureBullet({
  icon,
  title,
  description,
  delay,
}: FeatureBulletProps): React.JSX.Element {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      className="flex-row items-start mb-4"
    >
      <View className="w-10 h-10 rounded-full items-center justify-center mr-3 bg-nileGreen-500/15">
        <Ionicons name={icon} size={20} color={palette.nileGreen[500]} />
      </View>
      <View className="flex-1">
        <Text className="text-white font-semibold text-base">{title}</Text>
        <Text className="text-slate-400 text-sm mt-0.5">{description}</Text>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SmsPermissionPrompt({
  visible,
  onPermissionGranted,
  onDismiss,
  requestPermission,
}: SmsPermissionPromptProps): React.JSX.Element {
  const handleAllow = useCallback(async (): Promise<void> => {
    const result = await requestPermission();
    if (result === "granted") {
      onPermissionGranted();
    } else {
      onDismiss();
    }
  }, [requestPermission, onPermissionGranted, onDismiss]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View className="flex-1 bg-black/60 justify-end">
          <TouchableWithoutFeedback>
            <View className="bg-slate-900 rounded-t-3xl px-6 pt-8 pb-10">
              {/* Header Icon */}
              <Animated.View
                entering={FadeInUp.delay(200).springify()}
                className="items-center mb-6"
              >
                <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4 bg-nileGreen-500/20">
                  <Ionicons
                    name="chatbubble-ellipses"
                    size={32}
                    color={palette.nileGreen[500]}
                  />
                </View>
                <Text className="text-white text-2xl font-bold text-center">
                  Auto-Track Transactions
                </Text>
                <Text className="text-slate-400 text-base text-center mt-2 px-4">
                  Let Astik read your financial SMS to automatically track your
                  spending
                </Text>
              </Animated.View>

              {/* Feature Bullets */}
              <View className="mb-8">
                <FeatureBullet
                  icon="flash"
                  title="Instant Tracking"
                  description="Automatically detect transactions from your bank & wallet SMS"
                  delay={300}
                />
                <FeatureBullet
                  icon="shield-checkmark"
                  title="Private & Secure"
                  description="Your SMS messages are processed securely via encrypted connection. Your data is never stored or used for training."
                  delay={400}
                />
                <FeatureBullet
                  icon="checkmark-circle"
                  title="You're in Control"
                  description="Review every transaction before it's saved. Decline any you don't want."
                  delay={500}
                />
              </View>

              {/* Action Buttons */}
              <Animated.View entering={FadeInDown.delay(600).springify()}>
                <TouchableOpacity
                  onPress={() => {
                    handleAllow().catch(() => {});
                  }}
                  activeOpacity={0.85}
                  // eslint-disable-next-line react-native/no-inline-styles
                  style={{
                    shadowColor: palette.nileGreen[500],
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 8,
                  }}
                  className="bg-nileGreen-500 rounded-2xl py-4 items-center mb-3"
                >
                  <Text className="text-white font-bold text-lg">
                    Allow SMS Access
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onDismiss}
                  activeOpacity={0.7}
                  className="rounded-2xl py-3.5 items-center"
                >
                  <Text className="text-slate-500 font-medium text-base">
                    Not Now
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
