# GenWS - Expo React Native Conversion

## Project Overview

This project is a 1:1 conversion of the GenWS webapp (`genws_lovable/`) to Expo React Native (`genws/`). 

### Key Principles
- **Same Supabase backend** - Do NOT modify any backend tables, schemas, Edge Functions, RLS policies, or Storage buckets
- **Same features** - All functionality from the webapp must be preserved
- **Same design** - Visual design, colors, spacing, layout, and fonts must match exactly
- **Same business logic** - All validation, API calls, and user interactions must work identically

### Technology Stack
- **Expo SDK 54+** with Expo Router v4 (file-based routing)
- **TypeScript** strict mode
- **NativeWind v4** (Tailwind for React Native)
- **Supabase** (Auth, DB, Storage, Edge Functions, Realtime) - SAME PROJECT
- **@tanstack/react-query** for server state management
- **react-hook-form + zod** for forms
- **lucide-react-native** for icons
- **@rnmapbox/maps** for maps functionality
- **@stripe/stripe-react-native** for payments
- **expo-notifications** for push notifications
- **@gorhom/bottom-sheet** for modals and sheets
- **expo-image** for optimized images

### Conversion Guidelines

#### Element Mapping
- `div` → `View`
- `span, p, h1-h6` → `Text` (with className for sizing)
- `img` → `Image` (from expo-image)
- `input` → `TextInput`
- `button` → `Pressable`
- `a` → `Link` (from expo-router)
- `form` → `View` (submit logic on Pressable)
- `ul/li` → `FlatList` or `View` with `.map()`
- `table` → Custom FlatList-based component
- `textarea` → `TextInput` with `multiline={true}`

#### Event Mapping
- `onClick` → `onPress`
- `onChange` → `onChangeText` (TextInput) or `onValueChange` (Select)
- `onSubmit` → `onPress` on submit button
- `onFocus/onBlur` → same names

#### Navigation Mapping
- `useNavigate()` → `useRouter()`
- `useParams()` → `useLocalSearchParams()`
- `useSearchParams()` → `useLocalSearchParams()`
- `<Link to="/path">` → `<Link href="/path">`
- `navigate("/path")` → `router.push("/path")`
- `navigate("/path", { replace: true })` → `router.replace("/path")`
- `<Navigate to="/path" />` → `<Redirect href="/path" />`

#### Storage Mapping
- `localStorage` → `AsyncStorage` (non-sensitive) or `SecureStore` (sensitive)
- `sessionStorage` → In-memory state (`useState`/`useRef`)
- `Cookies` → Not applicable

#### Styling Notes
- CSS Grid → Flexbox (RN has no grid support)
- `position: fixed` → `position: absolute` + `SafeAreaView`
- `overflow: scroll` → `ScrollView` or `FlatList`
- `hover:` states → Not applicable on mobile
- `cursor: pointer` → Not applicable
- `box-shadow` → RN shadow props or NativeWind shadow classes
- `border-radius` → `rounded-*` classes work the same
- `opacity, transform` → Same in NativeWind
- `vh/vw` units → Use `Dimensions` or `useWindowDimensions()`
- `rem/em` units → Not supported, use direct values

### Backend Rules - DO NOT MODIFY
- ❌ DO NOT modify Supabase tables or schema
- ❌ DO NOT modify Edge Functions
- ❌ DO NOT modify RLS policies
- ❌ DO NOT modify Supabase Storage buckets
- ✅ ONLY new addition: `push_tokens` table for push notifications
- ✅ Use EXACT SAME Supabase URL and anon key from webapp

### Quality Checklist
Apply to every screen/component:
- [ ] All data loads correctly from Supabase
- [ ] All forms validate and submit correctly
- [ ] All navigation works (push, back, tabs)
- [ ] Loading spinners shown during data fetch
- [ ] Error messages shown on failure
- [ ] Empty states shown when no data
- [ ] Keyboard doesn't cover inputs
- [ ] Safe area respected (notch, Dynamic Island, home indicator)
- [ ] Pull-to-refresh works on list screens
- [ ] Works on iOS
- [ ] Works on Android
- [ ] TypeScript has no errors

### Reference Project
Always reference the original files in `genws_lovable/src/` when converting:
1. Read the original file first
2. Read all related sub-components, hooks, and utilities it imports
3. Understand every piece of state, API call, and user interaction
4. Create the native version preserving ALL functionality
5. Keep the SAME visual design and business logic
6. ONLY change: HTML elements → RN elements, CSS → NativeWind, react-router → expo-router
