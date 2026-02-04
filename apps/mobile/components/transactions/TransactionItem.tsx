// import { colors, palette } from "@/constants/colors";
// import { Category, Transaction } from "@astik/db";
// import { Ionicons } from "@expo/vector-icons";
// import { withObservables } from "@nozbe/watermelondb/react";
// import { BlurView } from "expo-blur";
// import {
//   Platform,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
// } from "react-native";

// interface TransactionItemProps {
//   transaction: Transaction;
//   category: Category;
//   onPress?: (transaction: Transaction) => void;
// }

// function TransactionItem({
//   transaction,
//   category,
//   onPress,
// }: TransactionItemProps) {
//   const categoryName = category.displayName;
//   const categoryIcon = category.icon;
//   const categoryColor = category.color;

//   const isIncome = transaction.isIncome;
//   const amountColor = isIncome ? colors.success : colors.expense;
//   const sign = isIncome ? "+" : "";

//   // Content to render inside the blur or view
//   const renderContent = () => (
//     <View style={styles.innerContent}>
//       {/* Icon Container - Floating style */}
//       <View
//         style={[
//           styles.iconContainer,
//           {
//             backgroundColor: isIncome
//               ? "rgba(16, 185, 129, 0.2)" // semi-transparent success
//               : "rgba(255, 255, 255, 0.5)", // semi-transparent white
//           },
//         ]}
//       >
//         <Ionicons
//           name={categoryIcon as keyof typeof Ionicons.glyphMap}
//           size={22}
//           color={categoryColor}
//         />
//       </View>

//       <View style={styles.textContainer}>
//         <Text style={styles.merchantText} numberOfLines={1}>
//           {transaction.merchant || categoryName}
//         </Text>
//         <Text style={styles.categoryText} numberOfLines={1}>
//           {categoryName}
//         </Text>
//       </View>

//       <Text style={[styles.amountText, { color: amountColor }]}>
//         {sign}
//         {transaction.amount.toLocaleString()} {transaction.currencySymbol}
//       </Text>
//     </View>
//   );

//   return (
//     <TouchableOpacity
//       onPress={() => onPress && onPress(transaction)}
//       activeOpacity={0.8}
//       style={styles.containerShadow}
//     >
//       <View style={styles.borderRadiusContainer}>
//         {Platform.OS === "ios" ? (
//           <BlurView intensity={30} tint="light" style={styles.blurContainer}>
//             {renderContent()}
//           </BlurView>
//         ) : (
//           <View style={styles.androidGlassContainer}>{renderContent()}</View>
//         )}
//       </View>
//     </TouchableOpacity>
//   );
// }

// const styles = StyleSheet.create({
//   containerShadow: {
//     marginBottom: 12,
//     borderRadius: 16,
//     // Soft shadow for depth
//     shadowColor: palette.nileGreen[900],
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.1,
//     shadowRadius: 10,
//     elevation: 4,
//   },
//   borderRadiusContainer: {
//     borderRadius: 16,
//     overflow: "hidden",
//     borderWidth: 1,
//     borderColor: "rgba(255, 255, 255, 0.4)", // Glass border
//   },
//   blurContainer: {
//     padding: 16,
//     backgroundColor: "rgba(255, 255, 255, 0.4)", // Fallback/Tint
//   },
//   androidGlassContainer: {
//     padding: 16,
//     backgroundColor: "rgba(255, 255, 255, 0.85)", // Less transparent on Android since no real blur
//   },
//   innerContent: {
//     flexDirection: "row",
//     alignItems: "center",
//   },
//   iconContainer: {
//     width: 48,
//     height: 48,
//     borderRadius: 24,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   textContainer: {
//     flex: 1,
//     marginLeft: 16,
//     marginRight: 12,
//   },
//   merchantText: {
//     fontSize: 16,
//     fontWeight: "600",
//     color: palette.slate[800], // Dark text for contrast against light glass
//     marginBottom: 2,
//     textShadowColor: "rgba(255, 255, 255, 0.5)",
//     textShadowOffset: { width: 0, height: 1 },
//     textShadowRadius: 0,
//   },
//   categoryText: {
//     fontSize: 13,
//     color: palette.slate[600],
//     fontWeight: "500",
//   },
//   amountText: {
//     fontSize: 16,
//     fontWeight: "700",
//     textAlign: "right",
//     textShadowColor: "rgba(255, 255, 255, 0.5)",
//     textShadowOffset: { width: 0, height: 1 },
//     textShadowRadius: 0,
//   },
// });

// const enhance = withObservables(["transaction"], ({ transaction }) => ({
//   transaction: transaction.observe(),
//   category: transaction.category.observe(),
// }));

// export default enhance(TransactionItem);
