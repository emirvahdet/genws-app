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
  TouchableOpacity,
} from "react-native";
import { WebView } from "react-native-webview";
import {
  CreditCard,
  Lock,
  ArrowLeft,
  Edit2,
  Check,
  X,
  Users,
  Crown,
} from "lucide-react-native";
import { format, addYears, subDays } from "date-fns";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface BillingInfo {
  name: string;
  email: string;
  country: string;
  address: string;
  billingType: "individual" | "organisation";
  organisationName?: string;
  taxNumber?: string;
}

interface FamilyMembershipData {
  id: string;
  family_number: number;
  member_count: number;
  is_active: boolean;
  primary_member_id: string;
  primary_member_name?: string;
  members: Array<{ id: string; full_name: string }>;
  isPrimaryMember: boolean;
}

interface CommitmentCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  isRenewal: boolean;
  currentExpiryDate?: string;
  onSuccess?: () => void;
  familyMembership?: FamilyMembershipData | null;
}

interface AppliedDiscount {
  discount_id: string;
  discount_name: string;
  discount_type: string;
  discount_value: number;
  final_price: number;
}

type CheckoutStep = "form" | "3dsecure" | "processing";

export const CommitmentCheckoutModal = ({
  open,
  onClose,
  isRenewal,
  currentExpiryDate,
  onSuccess,
  familyMembership,
}: CommitmentCheckoutModalProps) => {
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [price, setPrice] = useState<number>(1000);
  const [familyPrice2, setFamilyPrice2] = useState<number>(1500);
  const [familyPrice3, setFamilyPrice3] = useState<number>(2000);
  const [editingBilling, setEditingBilling] = useState(false);
  const [billingInfo, setBillingInfo] = useState<BillingInfo>({
    name: "",
    email: "",
    country: "",
    address: "",
    billingType: "individual",
    organisationName: "",
    taxNumber: "",
  });
  const [acceptedKvkk, setAcceptedKvkk] = useState(false);
  const [acceptedSales, setAcceptedSales] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [membershipType, setMembershipType] = useState<"individual" | "family">("individual");
  const [familyMemberCount, setFamilyMemberCount] = useState<2 | 3>(2);
  const [familySubmitting, setFamilySubmitting] = useState(false);
  const [familySubmitted, setFamilySubmitted] = useState(false);
  // Card form state
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  // 3D Secure state
  const [step, setStep] = useState<CheckoutStep>("form");
  const [iframeHtml, setIframeHtml] = useState<string | null>(null);
  // Legal dialog state
  const [showKvkkDialog, setShowKvkkDialog] = useState(false);
  const [showSalesDialog, setShowSalesDialog] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    __DEV__ && console.log('showKvkkDialog changed:', showKvkkDialog);
  }, [showKvkkDialog]);

  useEffect(() => {
    __DEV__ && console.log('showSalesDialog changed:', showSalesDialog);
  }, [showSalesDialog]);

  useEffect(() => {
    if (open) {
      fetchData();
      fetchExchangeRate();
      setAcceptedKvkk(false);
      setAcceptedSales(false);
      setPaymentReady(false);
      setStep("form");
      setIframeHtml(null);
      setMembershipType("individual");
      setFamilyMemberCount(2);
      setFamilySubmitted(false);
      setCardNumber("");
      setExpMonth("");
      setExpYear("");
      setCvv("");
    }
  }, [open]);

  // Set payment ready when exchange rate is loaded
  useEffect(() => {
    if (open && billingInfo.email && !loading && exchangeRate) {
      setPaymentReady(true);
    }
  }, [open, billingInfo.email, loading, exchangeRate]);

  const fetchExchangeRate = async () => {
    setExchangeRateLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-exchange-rate");
      if (error) throw error;
      if (data?.rate) {
        setExchangeRate(data.rate);
      }
    } catch (error) {
      __DEV__ && console.log("Error fetching exchange rate:", error);
      Alert.alert("Warning", "Could not fetch exchange rate. Please try again.");
    } finally {
      setExchangeRateLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      // Fetch price config
      const { data: config } = await supabase
        .from("commitment_config")
        .select("annual_fee_usd, annual_fee_2_members, annual_fee_3_members")
        .single();

      if (config) {
        setPrice(config.annual_fee_usd);
        if (config.annual_fee_2_members) setFamilyPrice2(config.annual_fee_2_members);
        if (config.annual_fee_3_members) setFamilyPrice3(config.annual_fee_3_members);

        // Fetch best discount
        const basePrice = familyMembership?.isPrimaryMember
          ? familyMembership.member_count === 3
            ? (config.annual_fee_3_members || 2000)
            : (config.annual_fee_2_members || 1500)
          : config.annual_fee_usd;

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: discountData, error: discountError } = await supabase.rpc(
            "get_best_commitment_discount",
            {
              p_user_id: user.id,
              p_base_price: basePrice,
              p_is_renewal: isRenewal,
            }
          );

          if (!discountError && discountData && discountData.length > 0) {
            setAppliedDiscount(discountData[0]);
          } else {
            setAppliedDiscount(null);
          }
        }
      }

      // Fetch user profile for billing info
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, country, city")
          .eq("id", user.id)
          .single();

        if (profile) {
          setBillingInfo((prev) => ({
            ...prev,
            name: profile.full_name || "",
            email: profile.email || user.email || "",
            country: profile.country || "",
            address: profile.city || "",
          }));
        }
      }
    } catch (error) {
      __DEV__ && console.log("Error fetching data:", error);
    }
  };

  const calculateExpiryDate = () => {
    if (isRenewal && currentExpiryDate) {
      return addYears(new Date(currentExpiryDate), 1);
    }
    return subDays(addYears(new Date(), 1), 1);
  };

  const expiryDate = calculateExpiryDate();
  const mandatoryTermsAccepted = acceptedKvkk && acceptedSales;

  // Pricing
  const basePrice = familyMembership?.isPrimaryMember
    ? familyMembership.member_count === 3 ? familyPrice3 : familyPrice2
    : price;
  const effectivePrice = appliedDiscount ? appliedDiscount.final_price : basePrice;
  const discountAmount = basePrice - effectivePrice;
  const totalAmount = effectivePrice;

  const formatCardNum = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").substring(0, 19);
  };

  const handleQnbPayment = async () => {
    if (!exchangeRate) {
      Alert.alert("Error", "Exchange rate not available. Please wait...");
      return;
    }
    if (!mandatoryTermsAccepted) {
      Alert.alert("Error", "Please accept the required terms before proceeding.");
      return;
    }
    const cleanCardNum = cardNumber.replace(/\s/g, "");
    if (cleanCardNum.length < 13 || !expMonth || !expYear || !cvv) {
      Alert.alert("Error", "Please fill in all card details.");
      return;
    }

    setPaymentLoading(true);
    try {
      const currentBasePrice = familyMembership?.isPrimaryMember
        ? familyMembership.member_count === 3 ? familyPrice3 : familyPrice2
        : price;
      const currentEffectivePrice = appliedDiscount ? appliedDiscount.final_price : currentBasePrice;
      const tryAmountRounded = Math.round(currentEffectivePrice * exchangeRate);

      const { data, error } = await supabase.functions.invoke("process-qnb-commitment", {
        body: {
          billingInfo,
          isRenewal,
          cardNumber: cleanCardNum,
          expMonth,
          expYear,
          cvv,
          tryAmount: tryAmountRounded,
          exchangeRate,
          discountId: appliedDiscount?.discount_id || null,
          originalPrice: currentBasePrice,
          discountedPrice: currentEffectivePrice,
          familyMembershipId: familyMembership?.isPrimaryMember ? familyMembership.id : null,
        },
      });

      if (error) throw error;

      if (data?.html) {
        setIframeHtml(data.html);
        setStep("3dsecure");
      }
    } catch (error: any) {
      __DEV__ && console.log("QNB payment error:", error);
      Alert.alert("Payment Error", error.message || "Failed to process payment");
      setPaymentLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    Alert.alert("Commitment Confirmed!", "Your commitment has been successfully activated.");
    onClose();
    onSuccess?.();
  };

  const handlePaymentError = (error: string) => {
    Alert.alert("Payment Failed", error);
  };

  const handleWebViewMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data?.type === "qnb-payment-result") {
          setStep("form");
          setIframeHtml(null);
          setPaymentLoading(false);
          if (data.status === "success") {
            handlePaymentSuccess();
          } else {
            handlePaymentError(data.error || "Payment failed");
          }
        }
      } catch {}
    },
    [onClose, onSuccess]
  );

  const handleWebViewNavigation = useCallback(
    (navState: any) => {
      const url = navState.url || "";
      if (url.includes("payment-callback") || url.includes("payment-result")) {
        if (url.includes("status=success")) {
          setStep("form");
          setIframeHtml(null);
          setPaymentLoading(false);
          handlePaymentSuccess();
        } else if (url.includes("status=fail") || url.includes("status=error")) {
          setStep("form");
          setIframeHtml(null);
          setPaymentLoading(false);
          handlePaymentError("Payment was not completed");
        }
      }
    },
    [onClose, onSuccess]
  );

  const injectedJS = `
    (function() {
      window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'qnb-payment-result') {
          window.ReactNativeWebView.postMessage(JSON.stringify(e.data));
        }
      });
    })();
    true;
  `;

  const handleFamilySubmit = async () => {
    setFamilySubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");
      const { error } = await supabase.functions.invoke("send-family-membership-request", {
        body: { userId: user.id, familyMemberCount },
      });
      if (error) throw error;
      setFamilySubmitted(true);
    } catch (error: any) {
      __DEV__ && console.log("Error submitting family request:", error);
      Alert.alert("Error", error.message || "Failed to submit request. Please try again.");
    } finally {
      setFamilySubmitting(false);
    }
  };

  const handleClose = () => {
    if (step === "3dsecure") {
      Alert.alert("Cancel Payment?", "3D Secure verification is in progress. Are you sure?", [
        { text: "Continue", style: "cancel" },
        {
          text: "Cancel",
          style: "destructive",
          onPress: () => {
            setStep("form");
            setIframeHtml(null);
            setPaymentLoading(false);
            onClose();
          },
        },
      ]);
      return;
    }
    onClose();
  };

  const RadioButton = ({ selected, onPress, label }: { selected: boolean; onPress: () => void; label: string }) => (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected ? Colors.primary : Colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && (
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary }} />
        )}
      </View>
      <Text style={{ fontSize: 14, color: Colors.foreground }}>{label}</Text>
    </Pressable>
  );

  const renderOrderSummary = () => (
    <View style={{ backgroundColor: "#0047110d", borderWidth: 1, borderColor: "#00471133", borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.primary, marginBottom: 12 }}>Order Summary</Text>

      {familyMembership?.isPrimaryMember ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <View style={{ backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 12, color: Colors.foreground }}>{familyMembership.member_count} Members</Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginBottom: 8 }}>
            Family membership valid until{" "}
            <Text style={{ fontWeight: "500" }}>{format(expiryDate, "MMMM d, yyyy")}</Text>
          </Text>
          <View style={{ backgroundColor: "white", borderRadius: 8, padding: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 4 }}>Members included:</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Crown size={10} color={Colors.primary} />
                <Text style={{ fontSize: 11, color: Colors.foreground }}>You (Primary)</Text>
              </View>
              {familyMembership.members.map((member) => (
                <View key={member.id} style={{ backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 11, color: Colors.foreground }}>{member.full_name}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : (
        <>
          {/* Individual / Family Selection */}
          <View style={{ flexDirection: "row", gap: 20, marginBottom: 16 }}>
            <RadioButton
              selected={membershipType === "individual"}
              onPress={() => setMembershipType("individual")}
              label="Individual"
            />
            <RadioButton
              selected={membershipType === "family"}
              onPress={() => setMembershipType("family")}
              label="Family"
            />
          </View>

          {membershipType === "individual" ? (
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginBottom: 8 }}>
              You are about to become Committed Society Member. Your membership will be valid until{" "}
              <Text style={{ fontWeight: "500" }}>{format(expiryDate, "MMMM d, yyyy")}</Text>
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
                Select the number of family members:
              </Text>
              <Pressable
                onPress={() => setFamilyMemberCount(2)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: familyMemberCount === 2 ? Colors.primary : Colors.border,
                  borderRadius: 10,
                  backgroundColor: familyMemberCount === 2 ? "#0047110d" : "transparent",
                }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 2,
                    borderColor: familyMemberCount === 2 ? Colors.primary : Colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {familyMemberCount === 2 && (
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary }} />
                  )}
                </View>
                <Text style={{ fontSize: 13, color: familyMemberCount === 2 ? Colors.primary : Colors.foreground, flex: 1 }}>
                  Family membership for 2 people
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setFamilyMemberCount(3)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: familyMemberCount === 3 ? Colors.primary : Colors.border,
                  borderRadius: 10,
                  backgroundColor: familyMemberCount === 3 ? "#0047110d" : "transparent",
                }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 2,
                    borderColor: familyMemberCount === 3 ? Colors.primary : Colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {familyMemberCount === 3 && (
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary }} />
                  )}
                </View>
                <Text style={{ fontSize: 13, color: familyMemberCount === 3 ? Colors.primary : Colors.foreground, flex: 1 }}>
                  Family membership for 3 people
                </Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      {/* Price breakdown — only for individual or family primary */}
      {(membershipType === "individual" || familyMembership?.isPrimaryMember) && (
        <View style={{ borderTopWidth: 1, borderTopColor: "#00471133", paddingTop: 12, marginTop: 12, gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 13, color: Colors.primary }}>
              {familyMembership?.isPrimaryMember ? "Family Annual Fee:" : "Annual Fee:"}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: Colors.primary,
                textDecorationLine: appliedDiscount ? "line-through" : "none",
              }}
            >
              USD {basePrice.toLocaleString()}
            </Text>
          </View>
          {appliedDiscount && (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, color: Colors.primary }}>
                {appliedDiscount.discount_name} (
                {appliedDiscount.discount_type === "percentage"
                  ? `${appliedDiscount.discount_value}%`
                  : `$${appliedDiscount.discount_value}`}
                ):
              </Text>
              <Text style={{ fontSize: 13, color: Colors.primary }}>
                - USD {discountAmount.toLocaleString()}
              </Text>
            </View>
          )}
          <View style={{ borderTopWidth: 1, borderTopColor: "#00471133", paddingTop: 8, marginTop: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 17, fontWeight: "600", color: Colors.primary }}>Total:</Text>
              <Text style={{ fontSize: 17, fontWeight: "600", color: Colors.primary }}>
                USD {totalAmount.toLocaleString()} / year
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: Colors.mutedForeground, textAlign: "right", marginTop: 2 }}>
              * VAT Included
            </Text>
          </View>
          {exchangeRateLoading && (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 8 }} />
          )}
        </View>
      )}
    </View>
  );

  const renderBillingInfo = () => (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>Billing Information</Text>
        <Pressable onPress={() => setEditingBilling(!editingBilling)} style={{ padding: 4 }}>
          {editingBilling ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Check size={14} color={Colors.primary} />
              <Text style={{ fontSize: 12, color: Colors.primary }}>Done</Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Edit2 size={14} color={Colors.mutedForeground} />
              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Edit</Text>
            </View>
          )}
        </Pressable>
      </View>

      {editingBilling ? (
        <View style={{ gap: 10 }}>
          {/* Billing Type */}
          <View>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 6 }}>Billing Type</Text>
            <View style={{ flexDirection: "row", gap: 20 }}>
              <RadioButton
                selected={billingInfo.billingType === "individual"}
                onPress={() => setBillingInfo({ ...billingInfo, billingType: "individual" })}
                label="Individual"
              />
              <RadioButton
                selected={billingInfo.billingType === "organisation"}
                onPress={() => setBillingInfo({ ...billingInfo, billingType: "organisation" })}
                label="Organisation"
              />
            </View>
          </View>
          {billingInfo.billingType === "organisation" && (
            <>
              <View>
                <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 4 }}>Organisation Name *</Text>
                <TextInput
                  style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.foreground }}
                  value={billingInfo.organisationName || ""}
                  onChangeText={(v) => setBillingInfo({ ...billingInfo, organisationName: v })}
                  placeholderTextColor={Colors.mutedForeground}
                />
              </View>
              <View>
                <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 4 }}>Tax Number *</Text>
                <TextInput
                  style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.foreground }}
                  value={billingInfo.taxNumber || ""}
                  onChangeText={(v) => setBillingInfo({ ...billingInfo, taxNumber: v })}
                  placeholderTextColor={Colors.mutedForeground}
                />
              </View>
            </>
          )}
          {[
            { label: "Name", key: "name" as const },
            { label: "Email", key: "email" as const },
            { label: "Country", key: "country" as const },
            { label: "Address", key: "address" as const },
          ].map((field) => (
            <View key={field.key}>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 4 }}>{field.label}</Text>
              <TextInput
                style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.foreground }}
                value={billingInfo[field.key]}
                onChangeText={(v) => setBillingInfo({ ...billingInfo, [field.key]: v })}
                keyboardType={field.key === "email" ? "email-address" : "default"}
                autoCapitalize={field.key === "email" ? "none" : "sentences"}
                placeholderTextColor={Colors.mutedForeground}
              />
            </View>
          ))}
        </View>
      ) : (
        <View style={{ backgroundColor: Colors.muted + "80", borderRadius: 10, padding: 12, gap: 4 }}>
          <Text style={{ fontSize: 13, color: Colors.foreground }}>
            <Text style={{ color: Colors.mutedForeground }}>Billing Type: </Text>
            {billingInfo.billingType === "organisation" ? "Organisation" : "Individual"}
          </Text>
          {billingInfo.billingType === "organisation" && (
            <>
              <Text style={{ fontSize: 13, color: Colors.foreground }}>
                <Text style={{ color: Colors.mutedForeground }}>Organisation: </Text>
                {billingInfo.organisationName || "Not set"}
              </Text>
              <Text style={{ fontSize: 13, color: Colors.foreground }}>
                <Text style={{ color: Colors.mutedForeground }}>Tax Number: </Text>
                {billingInfo.taxNumber || "Not set"}
              </Text>
            </>
          )}
          <Text style={{ fontSize: 13, color: Colors.foreground }}>
            <Text style={{ color: Colors.mutedForeground }}>Name: </Text>{billingInfo.name || "Not set"}
          </Text>
          <Text style={{ fontSize: 13, color: Colors.foreground }}>
            <Text style={{ color: Colors.mutedForeground }}>Email: </Text>{billingInfo.email || "Not set"}
          </Text>
          <Text style={{ fontSize: 13, color: Colors.foreground }}>
            <Text style={{ color: Colors.mutedForeground }}>Country: </Text>{billingInfo.country || "Not set"}
          </Text>
          <Text style={{ fontSize: 13, color: Colors.foreground }}>
            <Text style={{ color: Colors.mutedForeground }}>Address: </Text>{billingInfo.address || "Not set"}
          </Text>
        </View>
      )}
    </View>
  );

  const renderCardForm = () => (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground, marginBottom: 10 }}>Payment Details</Text>
      <View style={{ gap: 10 }}>
        <View>
          <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 4 }}>Card Number</Text>
          <TextInput
            style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 16, color: Colors.foreground, fontVariant: ["tabular-nums"] }}
            value={cardNumber}
            onChangeText={(v) => setCardNumber(formatCardNum(v))}
            placeholder="1234 5678 9012 3456"
            placeholderTextColor={Colors.mutedForeground}
            keyboardType="number-pad"
            maxLength={19}
            editable={!paymentLoading}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 4 }}>Month</Text>
            <TextInput
              style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 16, color: Colors.foreground, textAlign: "center" }}
              value={expMonth}
              onChangeText={(v) => setExpMonth(v.replace(/\D/g, "").substring(0, 2))}
              placeholder="MM"
              placeholderTextColor={Colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={2}
              editable={!paymentLoading}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 4 }}>Year</Text>
            <TextInput
              style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 16, color: Colors.foreground, textAlign: "center" }}
              value={expYear}
              onChangeText={(v) => setExpYear(v.replace(/\D/g, "").substring(0, 2))}
              placeholder="YY"
              placeholderTextColor={Colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={2}
              editable={!paymentLoading}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 4 }}>CVV</Text>
            <TextInput
              style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 16, color: Colors.foreground, textAlign: "center" }}
              value={cvv}
              onChangeText={(v) => setCvv(v.replace(/\D/g, "").substring(0, 4))}
              placeholder="123"
              placeholderTextColor={Colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              editable={!paymentLoading}
            />
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.muted + "80", borderRadius: 10, padding: 12, marginTop: 12 }}>
        <Lock size={12} color={Colors.mutedForeground} />
        <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
          Secure payment powered by QNB 3D Secure
        </Text>
      </View>
    </View>
  );

  const renderTerms = () => (
    <View style={{ marginBottom: 20, gap: 12 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>Terms & Agreements</Text>

      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          onPress={() => setAcceptedKvkk(!acceptedKvkk)}
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: acceptedKvkk ? Colors.primary : Colors.border,
            backgroundColor: acceptedKvkk ? Colors.primary : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {acceptedKvkk && <Check size={12} color="white" />}
        </Pressable>
        <Text style={{ fontSize: 12, color: Colors.foreground }}>I accept the </Text>
        <TouchableOpacity
          onPress={() => {
            __DEV__ && console.log('KVKK link tapped');
            setShowKvkkDialog(true);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ zIndex: 999 }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 12, color: Colors.primary, textDecorationLine: "underline" }}>
            KVKK Disclosure Notice
          </Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 12, color: Colors.destructive }}>*</Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          onPress={() => setAcceptedSales(!acceptedSales)}
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: acceptedSales ? Colors.primary : Colors.border,
            backgroundColor: acceptedSales ? Colors.primary : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {acceptedSales && <Check size={12} color="white" />}
        </Pressable>
        <Text style={{ fontSize: 12, color: Colors.foreground }}>I accept the </Text>
        <TouchableOpacity
          onPress={() => {
            __DEV__ && console.log('Distance Sales Agreement link tapped');
            setShowSalesDialog(true);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ zIndex: 999 }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 12, color: Colors.primary, textDecorationLine: "underline" }}>
            Distance Sales Agreement
          </Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 12, color: Colors.destructive }}>*</Text>
      </View>

      <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
        <Text style={{ color: Colors.destructive }}>*</Text> Required fields
      </Text>
    </View>
  );

  const renderMainForm = () => (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <CreditCard size={20} color={Colors.primary} />
          <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground }}>
            {isRenewal ? "Renew Your Commitment" : "Get Committed"}
          </Text>
        </View>

        {/* Family Request Submitted */}
        {membershipType === "family" && familySubmitted ? (
          <View style={{ backgroundColor: Colors.primary + "1A", borderWidth: 1, borderColor: Colors.primary + "4D", borderRadius: 12, padding: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Users size={16} color={Colors.primary} />
              <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.primary }}>Request Submitted</Text>
            </View>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
              We received your request. We will get back to you via email.
            </Text>
          </View>
        ) : (
          <>
            {renderOrderSummary()}

            {(membershipType === "individual" || familyMembership?.isPrimaryMember) ? (
              <>
                {renderBillingInfo()}
                {renderCardForm()}
                {renderTerms()}

                {/* Pay Now Button */}
                <Pressable
                  onPress={handleQnbPayment}
                  disabled={!paymentReady || loading || paymentLoading || !mandatoryTermsAccepted}
                  style={({ pressed }) => ({
                    backgroundColor: !paymentReady || loading || paymentLoading || !mandatoryTermsAccepted ? "#999" : Colors.primary,
                    borderRadius: 12,
                    paddingVertical: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  {loading || paymentLoading ? (
                    <>
                      <ActivityIndicator size="small" color="white" />
                      <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Processing...</Text>
                    </>
                  ) : !paymentReady ? (
                    <>
                      <ActivityIndicator size="small" color="white" />
                      <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Loading...</Text>
                    </>
                  ) : (
                    <>
                      <Lock size={16} color="white" />
                      <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Pay Now</Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : (
              /* Family Membership Submit */
              !familySubmitted && (
                <Pressable
                  onPress={handleFamilySubmit}
                  disabled={familySubmitting}
                  style={({ pressed }) => ({
                    backgroundColor: familySubmitting ? "#999" : Colors.primary,
                    borderRadius: 12,
                    paddingVertical: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  {familySubmitting ? (
                    <>
                      <ActivityIndicator size="small" color="white" />
                      <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Submitting...</Text>
                    </>
                  ) : (
                    <>
                      <Lock size={16} color="white" />
                      <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Submit</Text>
                    </>
                  )}
                </Pressable>
              )
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const render3DSecure = () => (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
        <Pressable
          onPress={() => {
            setStep("form");
            setIframeHtml(null);
            setPaymentLoading(false);
          }}
          style={{ padding: 4 }}
        >
          <ArrowLeft size={20} color={Colors.foreground} />
        </Pressable>
        <Lock size={18} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground }}>3D Secure Verification</Text>
          <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Complete the bank verification</Text>
        </View>
      </View>
      <WebView
        ref={webViewRef}
        source={{ html: iframeHtml || "" }}
        style={{ flex: 1 }}
        onMessage={handleWebViewMessage}
        onNavigationStateChange={handleWebViewNavigation}
        injectedJavaScript={injectedJS}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "white" }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      />
    </View>
  );

  const renderProcessing = () => (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
      <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 16 }} />
      <Text style={{ fontSize: 18, fontWeight: "600", color: Colors.foreground, marginBottom: 8, textAlign: "center" }}>
        Processing Payment
      </Text>
      <Text style={{ fontSize: 14, color: Colors.mutedForeground, textAlign: "center" }}>
        Please wait while we confirm your payment...
      </Text>
    </View>
  );

  return (
    <>
      {/* Main Commitment Modal */}
      <Modal visible={open && !showKvkkDialog && !showSalesDialog} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
        <View style={{ flex: 1, backgroundColor: "white" }}>
          {step === "form" && (
            <View style={{ flexDirection: "row", justifyContent: "flex-end", padding: 16, paddingBottom: 0 }}>
              <Pressable onPress={handleClose} style={{ padding: 4 }}>
                <X size={22} color={Colors.foreground} />
              </Pressable>
            </View>
          )}
          {step === "form" && renderMainForm()}
          {step === "3dsecure" && render3DSecure()}
          {step === "processing" && renderProcessing()}
        </View>
      </Modal>

      {/* KVKK Dialog */}
      <Modal visible={showKvkkDialog} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowKvkkDialog(false)}>
        <View style={{ flex: 1, backgroundColor: "white" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground }}>KVKK Disclosure Notice</Text>
            <Pressable onPress={() => setShowKvkkDialog(false)} style={{ padding: 4 }}>
              <X size={22} color={Colors.foreground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>1. Data Controller</Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, lineHeight: 20 }}>
              In accordance with Law No. 6698 on the Protection of Personal Data ("KVKK"), your personal data is processed by Karman Beyond as the data controller.
            </Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>2. Purpose of Data Processing</Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, lineHeight: 20 }}>
              Your personal data is processed for provision of services, payment processing, fulfillment of legal obligations, and communication regarding services and events.
            </Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>3. Your Rights Under KVKK</Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, lineHeight: 20 }}>
              You have the right to learn whether your data is processed, request information, request correction, request deletion, and claim compensation for damages due to unlawful processing.
            </Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>4. Contact</Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, lineHeight: 20 }}>
              To exercise your rights, please contact us through the Help & Support section of the application.
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Distance Sales Agreement Dialog */}
      <Modal visible={showSalesDialog} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSalesDialog(false)}>
        <View style={{ flex: 1, backgroundColor: "white" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground }}>Distance Sales Agreement</Text>
            <Pressable onPress={() => setShowSalesDialog(false)} style={{ padding: 4 }}>
              <X size={22} color={Colors.foreground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, lineHeight: 20 }}>
              This agreement has been prepared in accordance with Law No. 6502 on Consumer Protection and the Distance Contracts Regulation.
            </Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>1. Parties</Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, lineHeight: 20 }}>
              Seller: Karman Beyond{"\n"}Buyer: The member benefiting from the service
            </Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>2. Service Description</Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, lineHeight: 20 }}>
              The annual commitment plan provides the member with access to exclusive events, member directory, and other premium features for one year.
            </Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>3. Right of Withdrawal</Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, lineHeight: 20 }}>
              The buyer may exercise the right of withdrawal within 14 days from the date of the agreement by contacting through the Help & Support section.
            </Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>4. Acceptance</Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, lineHeight: 20 }}>
              By completing the payment, the buyer confirms that they have read, understood, and accepted all the terms and conditions.
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};
