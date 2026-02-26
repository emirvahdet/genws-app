import { useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";
import { Colors } from "../../constants/Colors";

interface DatePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}

export function DatePicker({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  required, 
  hint,
  minimumDate,
  maximumDate 
}: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const parseDate = (dateString: string) => {
    if (!dateString) {
      return new Date();
    }
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day);
    } catch {
      return new Date();
    }
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const currentDate = parseDate(value);

  const handleChange = (event: any, selectedDate?: Date) => {
    setShowPicker(false);
    if (selectedDate) {
      onChange(formatDate(selectedDate));
    }
  };

  const displayText = value
    ? currentDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : placeholder || "Select date";

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: "500", color: Colors.foreground, marginBottom: 6 }}>
        {label} {required && "*"}
      </Text>

      <Pressable
        onPress={() => setShowPicker(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: Colors.border,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 12,
          backgroundColor: "white",
          gap: 8,
        }}
      >
        <Calendar size={16} color={Colors.mutedForeground} />
        <Text style={{ flex: 1, fontSize: 14, color: value ? Colors.foreground : Colors.mutedForeground }}>
          {displayText}
        </Text>
      </Pressable>

      {hint && (
        <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 4 }}>
          {hint}
        </Text>
      )}

      {showPicker && (
        <Modal
          transparent
          animationType="slide"
          visible={showPicker}
          onRequestClose={() => setShowPicker(false)}
        >
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "white", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground, marginBottom: 16 }}>
                Select Date
              </Text>
              <DateTimePicker
                value={currentDate}
                mode="date"
                display="spinner"
                onChange={handleChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                style={{ marginBottom: 16 }}
              />
              <Pressable
                onPress={() => setShowPicker(false)}
                style={{ padding: 12, alignItems: "center", backgroundColor: Colors.muted, borderRadius: 8 }}
              >
                <Text style={{ color: Colors.foreground, fontWeight: "500" }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
