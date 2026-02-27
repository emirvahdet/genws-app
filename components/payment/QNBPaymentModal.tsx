import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import {
  CreditCard,
  Lock,
  ArrowLeft,
  Edit2,
  Check,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";
import { CountryPicker } from "../ui/CountryPicker";

interface BillingInfo {
  name: string;
  email: string;
  country: string;
  address: string;
  billingType: "individual" | "organisation";
  organisationName?: string;
  taxNumber?: string;
}

interface QNBPaymentModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  amount: number;
  currency: string;
  onPaymentSuccess: () => void;
}

type PaymentStep = "form" | "3dsecure" | "processing";

export const QNBPaymentModal = ({
  open,
  onClose,
  eventId,
  eventTitle,
  amount,
  currency,
  onPaymentSuccess,
}: QNBPaymentModalProps) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<PaymentStep>("form");
  const [cardData, setCardData] = useState({
    cardNumber: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
  });
  const [billingInfo, setBillingInfo] = useState<BillingInfo>({
    name: "",
    email: "",
    country: "",
    address: "",
    billingType: "individual",
  });
  const [editingBilling, setEditingBilling] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [cancellationAccepted, setCancellationAccepted] = useState(false);
  const [iframeHtml, setIframeHtml] = useState<string>("");
  const [paymentId, setPaymentId] = useState<string>("");
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (open) {
      fetchBillingInfo();
      setStep("form");
      setIframeHtml("");
      setPaymentId("");
      setLoading(false);
      setCardData({ cardNumber: "", expiryMonth: "", expiryYear: "", cvv: "" });
      setEditingBilling(false);
      setErrors({});
      setTermsAccepted(false);
      setCancellationAccepted(false);
    }
  }, [open]);

  const fetchBillingInfo = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, country, city")
          .eq("id", user.id)
          .single();

        if (profile) {
          setBillingInfo({
            name: profile.full_name || "",
            email: profile.email || user.email || "",
            country: profile.country || "",
            address: profile.city || "",
            billingType: "individual",
          });
        }
      }
    } catch (error) {
      __DEV__ && console.log("Error fetching billing info:", error);
    }
  };

  const handleClose = () => {
    if (step === "3dsecure") {
      Alert.alert(
        "Cancel Payment?",
        "3D Secure verification is in progress. Are you sure you want to cancel?",
        [
          { text: "Continue Payment", style: "cancel" },
          {
            text: "Cancel",
            style: "destructive",
            onPress: () => {
              setStep("form");
              setIframeHtml("");
              setLoading(false);
              onClose();
            },
          },
        ]
      );
      return;
    }
    onClose();
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!billingInfo.name.trim()) {
      newErrors.billingName = "Billing name is required";
    }

    const cardNum = cardData.cardNumber.replace(/\s/g, "");
    if (!cardNum) {
      newErrors.cardNumber = "Card number is required";
    } else if (cardNum.length < 13) {
      newErrors.cardNumber = "Card number must be at least 13 digits";
    }

    if (!cardData.expiryMonth) {
      newErrors.expiryMonth = "Month is required";
    } else if (
      parseInt(cardData.expiryMonth) < 1 ||
      parseInt(cardData.expiryMonth) > 12
    ) {
      newErrors.expiryMonth = "Invalid month";
    }

    if (!cardData.expiryYear) {
      newErrors.expiryYear = "Year is required";
    } else if (cardData.expiryYear.length !== 2) {
      newErrors.expiryYear = "Year must be 2 digits";
    }

    if (!cardData.cvv) {
      newErrors.cvv = "CVV is required";
    } else if (cardData.cvv.length < 3 || cardData.cvv.length > 4) {
      newErrors.cvv = "CVV must be 3 or 4 digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCardNumberChange = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const formatted = digits.replace(/(\d{4})/g, "$1 ").trim();
    setCardData((prev) => ({ ...prev, cardNumber: formatted.slice(0, 19) }));
  };

  const handleSubmit = async () => {
    if (!termsAccepted || !cancellationAccepted) {
      Alert.alert(
        "Acceptance Required",
        "Please accept both terms and cancellation policy"
      );
      return;
    }

    if (!validateForm()) {
      Alert.alert("Validation Error", "Please check the form for errors");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase.functions.invoke(
        "process-qnb-payment",
        {
          body: {
            eventId,
            amount,
            currency,
            cardNumber: cardData.cardNumber.replace(/\s/g, ""),
            expiryMonth: cardData.expiryMonth,
            expiryYear: cardData.expiryYear,
            cvv: cardData.cvv,
            cardHolderName: billingInfo.name,
            billingInfo,
            termsAccepted,
            cancellationPolicyAccepted: cancellationAccepted,
            useIframe: true,
          },
        }
      );

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Payment initialization failed");
      }

      setPaymentId(data.paymentId);
      setIframeHtml(data.formHtml);
      setStep("3dsecure");
    } catch (error: any) {
      __DEV__ && console.log("Payment error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Payment Failed",
        error.message || "Failed to process payment"
      );
      setLoading(false);
    }
  };

  const handleWebViewMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data?.type === "qnb-payment-result") {
          if (data.status === "success") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setStep("processing");
            setTimeout(() => {
              onPaymentSuccess();
              onClose();
            }, 1500);
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setStep("form");
            Alert.alert(
              "Payment Failed",
              data.error || "Payment was not completed"
            );
            setLoading(false);
          }
        }
      } catch {
        // Not JSON, ignore
      }
    },
    [onPaymentSuccess, onClose]
  );

  const handleWebViewNavigation = useCallback(
    (navState: any) => {
      const url = navState.url || "";
      // Check if callback URL contains payment result
      if (url.includes("payment-callback") || url.includes("payment-result")) {
        // The callback page should postMessage the result
        // But as a fallback, check URL params
        if (url.includes("status=success")) {
          setStep("processing");
          setTimeout(() => {
            onPaymentSuccess();
            onClose();
          }, 1500);
        } else if (url.includes("status=fail") || url.includes("status=error")) {
          setStep("form");
          Alert.alert("Payment Failed", "Payment was not completed");
          setLoading(false);
        }
      }
    },
    [onPaymentSuccess, onClose]
  );

  // Inject script to capture postMessage and forward to RN
  const injectedJS = `
    (function() {
      window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'qnb-payment-result') {
          window.ReactNativeWebView.postMessage(JSON.stringify(e.data));
        }
      });
      // Also capture from parent
      if (window.parent !== window) {
        window.parent.addEventListener('message', function(e) {
          if (e.data && e.data.type === 'qnb-payment-result') {
            window.ReactNativeWebView.postMessage(JSON.stringify(e.data));
          }
        });
      }
    })();
    true;
  `;

  const renderCardForm = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <CreditCard size={20} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: Colors.foreground,
              }}
            >
              Payment Details
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: Colors.mutedForeground,
                marginTop: 2,
              }}
            >
              Complete your payment for {eventTitle}
            </Text>
          </View>
        </View>

        {/* Amount */}
        <View
          style={{
            backgroundColor: Colors.muted,
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                color: Colors.foreground,
              }}
            >
              Total Amount:
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: Colors.primary,
              }}
            >
              {currency === "USD" ? "$" : "₺"}
              {amount.toFixed(2)} {currency}
            </Text>
          </View>
        </View>

        {/* Billing Information */}
        <View
          style={{
            backgroundColor: Colors.muted + "80",
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: Colors.foreground,
              }}
            >
              Billing Information
            </Text>
            <Pressable
              onPress={() => setEditingBilling(!editingBilling)}
              style={{ padding: 4 }}
            >
              {editingBilling ? (
                <Check size={16} color={Colors.primary} />
              ) : (
                <Edit2 size={16} color={Colors.mutedForeground} />
              )}
            </Pressable>
          </View>

          {editingBilling ? (
            <View style={{ gap: 12 }}>
              {/* Billing Type */}
              <View>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.mutedForeground,
                    marginBottom: 6,
                  }}
                >
                  Billing Type
                </Text>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <Pressable
                    onPress={() =>
                      setBillingInfo({
                        ...billingInfo,
                        billingType: "individual",
                      })
                    }
                    style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderWidth: 2,
                        borderColor:
                          billingInfo.billingType === "individual"
                            ? Colors.primary
                            : Colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {billingInfo.billingType === "individual" && (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: Colors.primary,
                          }}
                        />
                      )}
                    </View>
                    <Text style={{ fontSize: 14, color: Colors.foreground }}>
                      Individual
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      setBillingInfo({
                        ...billingInfo,
                        billingType: "organisation",
                      })
                    }
                    style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderWidth: 2,
                        borderColor:
                          billingInfo.billingType === "organisation"
                            ? Colors.primary
                            : Colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {billingInfo.billingType === "organisation" && (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: Colors.primary,
                          }}
                        />
                      )}
                    </View>
                    <Text style={{ fontSize: 14, color: Colors.foreground }}>
                      Organisation
                    </Text>
                  </Pressable>
                </View>
              </View>

              {billingInfo.billingType === "organisation" && (
                <>
                  <View>
                    <Text
                      style={{
                        fontSize: 12,
                        color: Colors.mutedForeground,
                        marginBottom: 4,
                      }}
                    >
                      Organisation Name *
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: Colors.input,
                        borderWidth: 1,
                        borderColor: Colors.border,
                        borderRadius: 10,
                        padding: 10,
                        fontSize: 14,
                        color: Colors.foreground,
                      }}
                      value={billingInfo.organisationName || ""}
                      onChangeText={(v) =>
                        setBillingInfo({ ...billingInfo, organisationName: v })
                      }
                      placeholder="Company Name"
                      placeholderTextColor={Colors.mutedForeground}
                    />
                  </View>
                  <View>
                    <Text
                      style={{
                        fontSize: 12,
                        color: Colors.mutedForeground,
                        marginBottom: 4,
                      }}
                    >
                      Tax Number *
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: Colors.input,
                        borderWidth: 1,
                        borderColor: Colors.border,
                        borderRadius: 10,
                        padding: 10,
                        fontSize: 14,
                        color: Colors.foreground,
                      }}
                      value={billingInfo.taxNumber || ""}
                      onChangeText={(v) =>
                        setBillingInfo({ ...billingInfo, taxNumber: v })
                      }
                      placeholder="Tax Number"
                      placeholderTextColor={Colors.mutedForeground}
                    />
                  </View>
                </>
              )}

              <View>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.mutedForeground,
                    marginBottom: 4,
                  }}
                >
                  Name *
                </Text>
                <TextInput
                  style={{
                    backgroundColor: Colors.input,
                    borderWidth: 1,
                    borderColor: errors.billingName
                      ? Colors.destructive
                      : Colors.border,
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 14,
                    color: Colors.foreground,
                  }}
                  value={billingInfo.name}
                  onChangeText={(v) =>
                    setBillingInfo({ ...billingInfo, name: v })
                  }
                  placeholder="Full Name"
                  placeholderTextColor={Colors.mutedForeground}
                />
                {errors.billingName && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.destructive,
                      marginTop: 4,
                    }}
                  >
                    {errors.billingName}
                  </Text>
                )}
              </View>

              <View>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.mutedForeground,
                    marginBottom: 4,
                  }}
                >
                  Email
                </Text>
                <TextInput
                  style={{
                    backgroundColor: Colors.input,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 14,
                    color: Colors.foreground,
                  }}
                  value={billingInfo.email}
                  onChangeText={(v) =>
                    setBillingInfo({ ...billingInfo, email: v })
                  }
                  placeholder="Email"
                  placeholderTextColor={Colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <CountryPicker
                label="Country"
                value={billingInfo.country}
                onChange={(v) =>
                  setBillingInfo({ ...billingInfo, country: v })
                }
                placeholder="Select country"
              />

              <View>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.mutedForeground,
                    marginBottom: 4,
                  }}
                >
                  Address
                </Text>
                <TextInput
                  style={{
                    backgroundColor: Colors.input,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 14,
                    color: Colors.foreground,
                  }}
                  value={billingInfo.address}
                  onChangeText={(v) =>
                    setBillingInfo({ ...billingInfo, address: v })
                  }
                  placeholder="City / Address"
                  placeholderTextColor={Colors.mutedForeground}
                />
              </View>
            </View>
          ) : (
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 13, color: Colors.foreground }}>
                <Text style={{ color: Colors.mutedForeground }}>
                  Billing Type:{" "}
                </Text>
                {billingInfo.billingType === "organisation"
                  ? "Organisation"
                  : "Individual"}
              </Text>
              {billingInfo.billingType === "organisation" && (
                <>
                  <Text style={{ fontSize: 13, color: Colors.foreground }}>
                    <Text style={{ color: Colors.mutedForeground }}>
                      Organisation:{" "}
                    </Text>
                    {billingInfo.organisationName || "Not set"}
                  </Text>
                  <Text style={{ fontSize: 13, color: Colors.foreground }}>
                    <Text style={{ color: Colors.mutedForeground }}>
                      Tax Number:{" "}
                    </Text>
                    {billingInfo.taxNumber || "Not set"}
                  </Text>
                </>
              )}
              <Text style={{ fontSize: 13, color: Colors.foreground }}>
                <Text style={{ color: Colors.mutedForeground }}>Name: </Text>
                {billingInfo.name || "Not provided"}
              </Text>
              <Text style={{ fontSize: 13, color: Colors.foreground }}>
                <Text style={{ color: Colors.mutedForeground }}>Email: </Text>
                {billingInfo.email}
              </Text>
              {(billingInfo.address || billingInfo.country) && (
                <Text style={{ fontSize: 13, color: Colors.foreground }}>
                  <Text style={{ color: Colors.mutedForeground }}>
                    Address:{" "}
                  </Text>
                  {[billingInfo.address, billingInfo.country]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Card Details */}
        <View style={{ gap: 12, marginBottom: 20 }}>
          <View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: Colors.foreground,
                marginBottom: 6,
              }}
            >
              Card Number *
            </Text>
            <TextInput
              style={{
                backgroundColor: Colors.input,
                borderWidth: 1,
                borderColor: errors.cardNumber
                  ? Colors.destructive
                  : Colors.border,
                borderRadius: 10,
                padding: 12,
                fontSize: 16,
                color: Colors.foreground,
                fontVariant: ["tabular-nums"],
              }}
              value={cardData.cardNumber}
              onChangeText={handleCardNumberChange}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={Colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={19}
              editable={!loading}
            />
            {errors.cardNumber && (
              <Text
                style={{
                  fontSize: 12,
                  color: Colors.destructive,
                  marginTop: 4,
                }}
              >
                {errors.cardNumber}
              </Text>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: Colors.foreground,
                  marginBottom: 6,
                }}
              >
                Month *
              </Text>
              <TextInput
                style={{
                  backgroundColor: Colors.input,
                  borderWidth: 1,
                  borderColor: errors.expiryMonth
                    ? Colors.destructive
                    : Colors.border,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 16,
                  color: Colors.foreground,
                  textAlign: "center",
                }}
                value={cardData.expiryMonth}
                onChangeText={(v) =>
                  setCardData((prev) => ({
                    ...prev,
                    expiryMonth: v.replace(/\D/g, "").slice(0, 2),
                  }))
                }
                placeholder="MM"
                placeholderTextColor={Colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={2}
                editable={!loading}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: Colors.foreground,
                  marginBottom: 6,
                }}
              >
                Year *
              </Text>
              <TextInput
                style={{
                  backgroundColor: Colors.input,
                  borderWidth: 1,
                  borderColor: errors.expiryYear
                    ? Colors.destructive
                    : Colors.border,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 16,
                  color: Colors.foreground,
                  textAlign: "center",
                }}
                value={cardData.expiryYear}
                onChangeText={(v) =>
                  setCardData((prev) => ({
                    ...prev,
                    expiryYear: v.replace(/\D/g, "").slice(0, 2),
                  }))
                }
                placeholder="YY"
                placeholderTextColor={Colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={2}
                editable={!loading}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: Colors.foreground,
                  marginBottom: 6,
                }}
              >
                CVV *
              </Text>
              <TextInput
                style={{
                  backgroundColor: Colors.input,
                  borderWidth: 1,
                  borderColor: errors.cvv
                    ? Colors.destructive
                    : Colors.border,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 16,
                  color: Colors.foreground,
                  textAlign: "center",
                }}
                value={cardData.cvv}
                onChangeText={(v) =>
                  setCardData((prev) => ({
                    ...prev,
                    cvv: v.replace(/\D/g, "").slice(0, 4),
                  }))
                }
                placeholder="123"
                placeholderTextColor={Colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                editable={!loading}
              />
            </View>
          </View>
        </View>

        {/* Security Note */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: Colors.muted,
            borderRadius: 10,
            padding: 12,
            marginBottom: 20,
          }}
        >
          <Lock size={14} color={Colors.mutedForeground} />
          <Text style={{ fontSize: 12, color: Colors.mutedForeground, flex: 1 }}>
            Your payment is secured with 3D Secure authentication
          </Text>
        </View>

        {/* Terms */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: Colors.border,
            paddingTop: 16,
            gap: 14,
            marginBottom: 20,
          }}
        >
          <Pressable
            onPress={() => setTermsAccepted(!termsAccepted)}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: termsAccepted ? Colors.primary : Colors.border,
                backgroundColor: termsAccepted ? Colors.primary : "transparent",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
              }}
            >
              {termsAccepted && <Check size={12} color="white" />}
            </View>
            <Text style={{ fontSize: 13, color: Colors.foreground, flex: 1, lineHeight: 18 }}>
              I have read and understood the{" "}
              <Text style={{ color: Colors.primary, textDecorationLine: "underline" }}>
                Mesafeli Satış Sözleşmesi
              </Text>
              .
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setCancellationAccepted(!cancellationAccepted)}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: cancellationAccepted
                  ? Colors.primary
                  : Colors.border,
                backgroundColor: cancellationAccepted
                  ? Colors.primary
                  : "transparent",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
              }}
            >
              {cancellationAccepted && <Check size={12} color="white" />}
            </View>
            <Text style={{ fontSize: 13, color: Colors.foreground, flex: 1, lineHeight: 18 }}>
              I have read and accepted the{" "}
              <Text style={{ color: Colors.primary, textDecorationLine: "underline" }}>
                Cancellation Policy
              </Text>
              .
            </Text>
          </Pressable>
        </View>

        {/* Submit Button */}
        <Pressable
          onPress={handleSubmit}
          disabled={loading || !termsAccepted || !cancellationAccepted}
          style={({ pressed }) => ({
            backgroundColor:
              loading || !termsAccepted || !cancellationAccepted
                ? "#999"
                : Colors.primary,
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {loading ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ActivityIndicator size="small" color="white" />
              <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
                Processing...
              </Text>
            </View>
          ) : (
            <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
              Confirm Payment
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const render3DSecure = () => (
    <View style={{ flex: 1 }}>
      {/* 3DS Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
        }}
      >
        <Pressable
          onPress={() => {
            setStep("form");
            setIframeHtml("");
            setLoading(false);
          }}
          style={{ padding: 4 }}
        >
          <ArrowLeft size={20} color={Colors.foreground} />
        </Pressable>
        <Lock size={18} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: Colors.foreground,
            }}
          >
            3D Secure Authentication
          </Text>
          <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
            Complete the bank verification
          </Text>
        </View>
      </View>

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ html: iframeHtml }}
        style={{ flex: 1 }}
        onMessage={handleWebViewMessage}
        onNavigationStateChange={handleWebViewNavigation}
        injectedJavaScript={injectedJS}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "white",
            }}
          >
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      />
    </View>
  );

  const renderProcessing = () => (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
    >
      <ActivityIndicator
        size="large"
        color={Colors.primary}
        style={{ marginBottom: 16 }}
      />
      <Text
        style={{
          fontSize: 18,
          fontWeight: "600",
          color: Colors.foreground,
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        Processing Payment
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: Colors.mutedForeground,
          textAlign: "center",
        }}
      >
        Please wait while we confirm your payment...
      </Text>
    </View>
  );

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, backgroundColor: "white" }}>
        {/* Close button */}
        {step === "form" && (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              padding: 16,
              paddingBottom: 0,
            }}
          >
            <Pressable
              onPress={handleClose}
              style={{ padding: 4 }}
            >
              <X size={22} color={Colors.foreground} />
            </Pressable>
          </View>
        )}

        {step === "form" && renderCardForm()}
        {step === "3dsecure" && render3DSecure()}
        {step === "processing" && renderProcessing()}
      </View>
    </Modal>
  );
};
