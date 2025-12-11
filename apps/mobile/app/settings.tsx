import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SettingItemProps {
  icon: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
}

function SettingItem({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  rightElement,
  showChevron = true,
}: SettingItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "white",
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: `${iconColor}15`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon as any} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "500", color: "#1F2937" }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement ||
        (showChevron && (
          <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
        ))}
    </TouchableOpacity>
  );
}

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [biometrics, setBiometrics] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />

      {/* Header */}
      <View
        style={{
          backgroundColor: "#065F46",
          paddingTop: insets.top + 16,
          paddingBottom: 20,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text
          style={{
            color: "white",
            fontSize: 20,
            fontWeight: "bold",
            marginLeft: 16,
          }}
        >
          Settings
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Account Section */}
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: "#6B7280",
            marginLeft: 20,
            marginTop: 24,
            marginBottom: 8,
          }}
        >
          ACCOUNT
        </Text>
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 16,
            marginHorizontal: 16,
            overflow: "hidden",
          }}
        >
          <SettingItem
            icon="person"
            iconColor="#3B82F6"
            title="Profile"
            subtitle="Manage your account"
          />
          <SettingItem
            icon="wallet"
            iconColor="#10B981"
            title="Accounts"
            subtitle="4 accounts"
          />
          <SettingItem
            icon="card"
            iconColor="#8B5CF6"
            title="Linked Cards"
            subtitle="2 cards linked"
          />
        </View>

        {/* Preferences Section */}
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: "#6B7280",
            marginLeft: 20,
            marginTop: 24,
            marginBottom: 8,
          }}
        >
          PREFERENCES
        </Text>
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 16,
            marginHorizontal: 16,
            overflow: "hidden",
          }}
        >
          <SettingItem
            icon="cash"
            iconColor="#D97706"
            title="Default Currency"
            subtitle="EGP - Egyptian Pound"
          />
          <SettingItem
            icon="language"
            iconColor="#EC4899"
            title="Language"
            subtitle="English"
          />
          <SettingItem
            icon="moon"
            iconColor="#6366F1"
            title="Dark Mode"
            showChevron={false}
            rightElement={
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: "#E5E7EB", true: "#10B981" }}
                thumbColor="white"
              />
            }
          />
        </View>

        {/* Notifications Section */}
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: "#6B7280",
            marginLeft: 20,
            marginTop: 24,
            marginBottom: 8,
          }}
        >
          NOTIFICATIONS
        </Text>
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 16,
            marginHorizontal: 16,
            overflow: "hidden",
          }}
        >
          <SettingItem
            icon="notifications"
            iconColor="#F59E0B"
            title="Push Notifications"
            showChevron={false}
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: "#E5E7EB", true: "#10B981" }}
                thumbColor="white"
              />
            }
          />
          <SettingItem
            icon="chatbubble"
            iconColor="#14B8A6"
            title="Bank SMS Parsing"
            subtitle="Auto-detect bank transactions"
          />
        </View>

        {/* Security Section */}
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: "#6B7280",
            marginLeft: 20,
            marginTop: 24,
            marginBottom: 8,
          }}
        >
          SECURITY
        </Text>
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 16,
            marginHorizontal: 16,
            overflow: "hidden",
          }}
        >
          <SettingItem
            icon="finger-print"
            iconColor="#065F46"
            title="Biometric Login"
            showChevron={false}
            rightElement={
              <Switch
                value={biometrics}
                onValueChange={setBiometrics}
                trackColor={{ false: "#E5E7EB", true: "#10B981" }}
                thumbColor="white"
              />
            }
          />
          <SettingItem
            icon="lock-closed"
            iconColor="#EF4444"
            title="Change PIN"
          />
          <SettingItem
            icon="shield-checkmark"
            iconColor="#10B981"
            title="Privacy"
          />
        </View>

        {/* Support Section */}
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: "#6B7280",
            marginLeft: 20,
            marginTop: 24,
            marginBottom: 8,
          }}
        >
          SUPPORT
        </Text>
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 16,
            marginHorizontal: 16,
            overflow: "hidden",
          }}
        >
          <SettingItem
            icon="help-circle"
            iconColor="#3B82F6"
            title="Help Center"
          />
          <SettingItem
            icon="chatbubbles"
            iconColor="#8B5CF6"
            title="Contact Us"
          />
          <SettingItem icon="star" iconColor="#F59E0B" title="Rate App" />
        </View>

        {/* About Section */}
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: "#6B7280",
            marginLeft: 20,
            marginTop: 24,
            marginBottom: 8,
          }}
        >
          ABOUT
        </Text>
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 16,
            marginHorizontal: 16,
            overflow: "hidden",
          }}
        >
          <SettingItem
            icon="information-circle"
            iconColor="#6B7280"
            title="Version"
            subtitle="1.0.0"
            showChevron={false}
          />
          <SettingItem
            icon="document-text"
            iconColor="#6B7280"
            title="Terms of Service"
          />
          <SettingItem
            icon="shield"
            iconColor="#6B7280"
            title="Privacy Policy"
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={{
            marginHorizontal: 16,
            marginTop: 32,
            backgroundColor: "#FEE2E2",
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#EF4444", fontSize: 16, fontWeight: "600" }}>
            Sign Out
          </Text>
        </TouchableOpacity>

        {/* App Branding */}
        <View style={{ alignItems: "center", marginTop: 32 }}>
          <Text style={{ fontSize: 24, color: "#065F46", fontWeight: "bold" }}>
            أستيك
          </Text>
          <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 4 }}>
            Made with ❤️ in Egypt
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
