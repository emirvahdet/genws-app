import { useState, useEffect } from "react";
import { View, Text, Pressable, Modal, Platform, Alert } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar, Clock, X } from "lucide-react-native";
import { Colors } from "../../constants/Colors";

interface DateTimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function DateTimePickerComponent({ label, value, onChange, placeholder, required }: DateTimePickerProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  
  const parseDateTime = (dateTimeString: string) => {
    if (!dateTimeString) {
      // Default to today at next hour
      const now = new Date();
      const defaultDate = new Date(now);
      defaultDate.setHours(now.getHours() + 1, 0, 0, 0);
      return defaultDate;
    }
    try {
      // Handle YYYY-MM-DDTHH:MM format
      const [datePart, timePart] = dateTimeString.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = timePart ? timePart.split(':').map(Number) : [0, 0];
      return new Date(year, month - 1, day, hour, minute);
    } catch {
      // Fallback to today at next hour
      const now = new Date();
      const defaultDate = new Date(now);
      defaultDate.setHours(now.getHours() + 1, 0, 0, 0);
      return defaultDate;
    }
  };

  const formatDateTime = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}`;
  };

  const [currentDate, setCurrentDate] = useState(parseDateTime(value));

  // Update currentDate when value prop changes
  useEffect(() => {
    setCurrentDate(parseDateTime(value));
  }, [value]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    // Don't close the picker, just update the temporary date
    if (selectedDate) {
      // Keep the time from current date, update only date part
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(currentDate.getHours());
      newDateTime.setMinutes(currentDate.getMinutes());
      setTempDate(newDateTime);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    // Don't close the picker, just update the temporary date
    if (selectedTime) {
      // Keep the date from current date, update only time part
      const newDateTime = new Date(currentDate);
      newDateTime.setHours(selectedTime.getHours());
      newDateTime.setMinutes(selectedTime.getMinutes());
      setTempDate(newDateTime);
    }
  };

  const handleSaveDate = () => {
    setShowDatePicker(false);
    if (tempDate) {
      onChange(formatDateTime(tempDate));
    }
    setTempDate(null);
    // Show time picker after date selection
    if (Platform.OS === 'ios') {
      setTimeout(() => setShowTimePicker(true), 100);
    } else {
      // Android: show time picker immediately
      setTimeout(() => setShowTimePicker(true), 100);
    }
  };

  const handleSaveTime = () => {
    setShowTimePicker(false);
    if (tempDate) {
      onChange(formatDateTime(tempDate));
    }
    setTempDate(null);
  };

  const handleCancelDate = () => {
    setShowDatePicker(false);
    setTempDate(null);
  };

  const handleCancelTime = () => {
    setShowTimePicker(false);
    setTempDate(null);
  };

  const handleOpen = () => {
    setTempDate(currentDate);
    setShowDatePicker(true);
  };

  const displayText = value ? 
    `${currentDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at ${currentDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` :
    placeholder || "Select date and time";

  const handlePress = () => {
    if (value && !required) {
      // Show option to clear or change
      Alert.alert(
        "Date/Time",
        "What would you like to do?",
        [
          { text: "Clear", style: "destructive", onPress: () => onChange("") },
          { text: "Change", style: "default", onPress: handleOpen },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } else {
      handleOpen();
    }
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: "500", color: Colors.foreground, marginBottom: 6 }}>
        {label} {required && "*"}
      </Text>
      
      <Pressable
        onPress={handlePress}
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
        <Clock size={16} color={Colors.mutedForeground} />
      </Pressable>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal
          transparent
          animationType="slide"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "white", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <Pressable onPress={handleCancelDate} style={{ padding: 8 }}>
                  <X size={20} color={Colors.mutedForeground} />
                </Pressable>
                <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground }}>
                  Select Date
                </Text>
                <Pressable onPress={handleSaveDate} style={{ padding: 8, paddingHorizontal: 12, backgroundColor: Colors.primary, borderRadius: 6 }}>
                  <Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>Next</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={tempDate || currentDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                minimumDate={new Date()}
                style={{ marginBottom: 16 }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Time Picker Modal */}
      {showTimePicker && (
        <Modal
          transparent
          animationType="slide"
          visible={showTimePicker}
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "white", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <Pressable onPress={handleCancelTime} style={{ padding: 8 }}>
                  <X size={20} color={Colors.mutedForeground} />
                </Pressable>
                <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground }}>
                  Select Time
                </Text>
                <Pressable onPress={handleSaveTime} style={{ padding: 8, paddingHorizontal: 12, backgroundColor: Colors.primary, borderRadius: 6 }}>
                  <Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>Save</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={tempDate || currentDate}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                style={{ marginBottom: 16 }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
