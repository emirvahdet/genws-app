import { useRef } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { RichEditor, RichToolbar, actions } from "react-native-pell-rich-editor";
import { Colors } from "../../constants/Colors";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function RichTextEditor({ value, onChange, placeholder, label }: RichTextEditorProps) {
  const richText = useRef<RichEditor>(null);

  return (
    <View style={{ marginBottom: 16 }}>
      {label && (
        <Text style={{ fontSize: 13, fontWeight: "500", color: Colors.foreground, marginBottom: 6 }}>
          {label}
        </Text>
      )}
      <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 8, backgroundColor: "white" }}>
        <RichToolbar
          editor={richText}
          actions={[
            actions.setBold,
            actions.setItalic,
            actions.setUnderline,
            actions.setStrikethrough,
            actions.insertBulletsList,
            actions.insertOrderedList,
            actions.insertLink,
            actions.heading1,
            actions.heading2,
            actions.heading3,
          ]}
          iconTint={Colors.foreground}
          selectedIconTint={Colors.primary}
          disabledIconTint="#bbb"
          style={{
            backgroundColor: "#f9fafb",
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
          }}
        />
        <ScrollView style={{ height: 200 }}>
          <RichEditor
            ref={richText}
            initialContentHTML={value}
            onChange={onChange}
            placeholder={placeholder || "Enter description..."}
            style={{
              backgroundColor: "white",
              minHeight: 200,
            }}
            editorStyle={{
              backgroundColor: "white",
              color: "#324750",
              placeholderColor: "#999",
              contentCSSText: `
                font-size: 15px;
                line-height: 1.6;
                color: #324750;
                padding: 12px;
              `,
            }}
          />
        </ScrollView>
      </View>
    </View>
  );
}
