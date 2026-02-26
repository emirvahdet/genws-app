import { useState, useMemo } from "react";
import { View, Text, Modal, TextInput, Pressable } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { X } from "lucide-react-native";
import { Colors } from "../../constants/Colors";

interface CountryPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}

// Comprehensive list of all countries with standard international names
const ALL_COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
  "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas",
  "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize",
  "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil",
  "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China",
  "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba",
  "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia",
  "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
  "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada",
  "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras",
  "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
  "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan",
  "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait",
  "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia",
  "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi",
  "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania",
  "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia",
  "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru",
  "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria",
  "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau",
  "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines",
  "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe",
  "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
  "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea",
  "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden",
  "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand",
  "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Türkiye",
  "Turkmenistan", "Tuvalu", "UAE", "Uganda", "Ukraine", "United Kingdom",
  "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela",
  "Vietnam", "Yemen", "Zambia", "Zimbabwe"
].sort();

export function CountryPicker({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  required, 
  hint 
}: CountryPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempCountry, setTempCountry] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");

  const handleOpen = () => {
    setTempCountry(value || ALL_COUNTRIES[0]);
    setSearchText("");
    setShowPicker(true);
  };

  const handleSave = () => {
    onChange(tempCountry);
    setShowPicker(false);
    setSearchText("");
  };

  const handleCancel = () => {
    setShowPicker(false);
    setSearchText("");
  };

  const filteredCountries = useMemo(() => {
    if (!searchText.trim()) {
      return ALL_COUNTRIES;
    }
    return ALL_COUNTRIES.filter(country => 
      country.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [searchText]);

  const clearSearch = () => {
    setSearchText("");
  };

  const displayText = value || placeholder || "Select country";

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>
        {label} {required && "*"}
      </Text>

      <TextInput
        style={{
          backgroundColor: Colors.input,
          borderWidth: 1,
          borderColor: Colors.border,
          borderRadius: 10,
          padding: 9,
          fontSize: 13,
          color: Colors.foreground,
        }}
        value={displayText}
        editable={false}
        onPressIn={handleOpen}
        placeholder={placeholder}
        placeholderTextColor={Colors.mutedForeground}
      />

      {hint && (
        <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 2 }}>
          {hint}
        </Text>
      )}

      <Modal
        transparent
        animationType="slide"
        visible={showPicker}
        onRequestClose={handleCancel}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
          onPress={handleCancel}
        >
          <Pressable 
            style={{ backgroundColor: "white", borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
              <Pressable onPress={handleCancel} style={{ padding: 8 }}>
                <Text style={{ color: Colors.primary, fontSize: 16 }}>Cancel</Text>
              </Pressable>
              <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground }}>
                {label}
              </Text>
              <Pressable onPress={handleSave} style={{ padding: 8 }}>
                <Text style={{ color: Colors.primary, fontSize: 16, fontWeight: "600" }}>Save</Text>
              </Pressable>
            </View>
            
            {/* Search Field */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12 }}>
                <TextInput
                  style={{ flex: 1, paddingVertical: 8, fontSize: 14, color: Colors.foreground }}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Search country..."
                  placeholderTextColor={Colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchText.length > 0 && (
                  <Pressable onPress={clearSearch} style={{ padding: 4 }}>
                    <X size={16} color={Colors.mutedForeground} />
                  </Pressable>
                )}
              </View>
            </View>
            
            <Picker
              selectedValue={tempCountry}
              onValueChange={(itemValue) => setTempCountry(itemValue)}
              style={{ height: 216 }}
              itemStyle={{ height: 216 }}
            >
              {filteredCountries.map((country) => (
                <Picker.Item key={country} label={country} value={country} />
              ))}
            </Picker>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
