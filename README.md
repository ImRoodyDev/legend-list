# Legend List

**Legend List** is a high-performance list component for **React Native**, written purely in Typescript with no native dependencies. It is a drop-in replacement for `FlatList` and `FlashList` with better performance, especially when handling dynamically sized items.

<video src="https://github.com/user-attachments/assets/8641e305-ab06-4fb3-a96a-fd220df84985"></video>

---

## 🤔 Why Legend List?

*   **Performance:** Designed from the ground up and heavily optimized for performance, it is faster than FlatList and other list libraries in most scenarios.
*   **Dynamic Item Sizes:** Natively supports items with varying heights without performance hits.
*   **Drop-in Replacement:** API compatibility with `FlatList` and `FlashList` for easier migration.
*   **100% JS:** No native module linking required, ensuring easy integration and compatibility across platforms.
*   **Lightweight:** Our goal is to keep LegendList as small of a dependency as possible. For more advanced use cases, we plan on supporting optional plugins. This ensures that we keep the package size as small as possible.
*   **Bidirectional infinite lists:** Supports infinite scrolling in both directions with no flashes or scroll jumping
*   **Chat UIs without inverted:** Chat UIs can align their content to the bottom and maintain scroll at end, so that the list doesn't need to be inverted, which causes weird behavior (in animations, etc...)

For more information, listen to the Legend List episode of the [React Native Radio Podcast](https://infinite.red/react-native-radio/rnr-325-legend-list-with-jay-meistrich) and the [livestream with Expo](https://www.youtube.com/watch?v=XpZMveUCke8).

---
## ✨ Additional Features

Beyond standard `FlatList` capabilities:

*   `recycleItems`: (boolean) Toggles item component recycling.
    *   `true`: Reuses item components for optimal performance. Be cautious if your item components contain local state, as it might be reused unexpectedly.
    *   `false` (default): Creates new item components every time. Less performant but safer if items have complex internal state.
    *   On **tvOS** (react-native-tvos), the item that currently has focus is automatically protected from recycling, so D-pad scrolling keeps focus where it should be. See [📺 tvOS focus](#-tvos-focus).
*   `maintainScrollAtEnd`: Keeps the list pinned to the tail when the user is already near the end (within `maintainScrollAtEndThreshold * screen height`). Pass `true` for all triggers, or `{ animated?: boolean, on?: { dataChange?: boolean, layout?: boolean, itemLayout?: boolean } }`; if `on` is omitted, the object form also enables all triggers.
*   `maintainVisibleContentPosition`: Keeps visible content steady during size/layout changes while scrolling up or when items resize above the viewport (default). Pass `true` or `{ data: true }` to also anchor during data updates; pass `false` to disable; pass `{ size: false }` to opt out of scroll-time stabilization.
*   `alignItemsAtEnd`: (boolean) Useful for chat UIs, content smaller than the View will be aligned to the bottom of the list.

---

## 📺 tvOS focus

On **react-native-tvos**, navigating with the D-pad while `recycleItems={true}` used to lose focus: as you scroll, recycled containers swap their content and jump position, and the native tvOS focus engine drops focus from the view it was tracking.

Legend List now handles this for you — **no extra props or configuration required**. The item that currently holds focus is protected from being recycled, so focus stays on the right item while scrolling.

The only requirement is that the focusable element lives **inside `renderItem`** (which is the normal way to build TV rows):

```tsx
import { Pressable, Text } from "react-native";
import { LegendList } from "@legendapp/list/react-native";

<LegendList
    data={data}
    recycleItems
    keyExtractor={(item) => item.id}
    renderItem={({ item }) => (
        // A focusable element (Pressable / TouchableOpacity / focusable View)
        // inside renderItem is what the focus engine targets and what gets preserved.
        <Pressable onPress={() => onSelect(item)}>
            <Text>{item.name}</Text>
        </Pressable>
    )}
/>
```

Legend List detects TV via `Platform.isTV`, so the behavior activates only on tvOS and adds no overhead on other platforms.

---

## 🪝 Hooks

### `useWrapperStyle()`

Legend List positions each item by rendering an absolutely-positioned **wrapper** view around it. `useWrapperStyle()` returns a setter that lets an item apply extra style to *its own* wrapper — for example raising `zIndex` on hover so the item can visually overlap its neighbors.

```tsx
import { useWrapperStyle } from "@legendapp/list/react-native"; // or "@legendapp/list/react"

function Item() {
    const setWrapperStyle = useWrapperStyle();
    return (
        <Pressable
            onHoverIn={() => setWrapperStyle({ zIndex: 10 })}
            onHoverOut={() => setWrapperStyle(undefined)}
        />
    );
}
```

**Why use it instead of styling the item directly?** The style is written to a per-container signal, so calling the setter re-renders **only this item's wrapper** — not the item component itself, and not the rest of the list. Because the item never re-renders, it's ideal for high-frequency interactions like hover and press.

**What you can set:** The list owns the layout props (`position`, `top`/`left`, width/height). Anything else you pass — `zIndex`, `opacity`, `transform`, etc. — is merged on top of those. Pass `undefined` to clear the style.

**Cleanup:** The wrapper style is reset automatically when the container is recycled to a different item, so you don't need to clean it up yourself.

> Must be called from a component rendered inside a Legend List item (i.e. within `renderItem`). Called outside of an item it fails gracefully and does nothing.

---

## 📚 Documentation

For comprehensive documentation, guides, and the full API reference, please visit:

➡️ **[Legend List Documentation Site](https://www.legendapp.com/open-source/list)**

---

## 💻 Usage

### Installation

```bash
# Using Bun
bun add @legendapp/list

# Using npm
npm install @legendapp/list

# Using Yarn
yarn add @legendapp/list
```

### Typed Imports

- React Native: `@legendapp/list/react-native`
- React: `@legendapp/list/react`

### Example
```tsx
import React, { useRef } from "react"
import { View, Image, Text, StyleSheet } from "react-native"
import { LegendList, LegendListRef, LegendListRenderItemProps } from "@legendapp/list/react-native"

// Define the type for your data items
interface UserData {
    id: string;
    name: string;
    photoUri: string;
}

const LegendListExample = () => {
    // Optional: Ref for accessing list methods (e.g., scrollTo)
    const listRef = useRef<LegendListRef | null>(null)

    const data = []

    const renderItem = ({ item }: LegendListRenderItemProps<UserData>) => {
        return (
            <View>
                <Image source={{ uri: item.photoUri }} />
                <Text>{item.name}</Text>
            </View>
        )
    }

    return (
        <LegendList
            // Required Props
            data={data}
            renderItem={renderItem}

            // Recommended props (Improves performance)
            keyExtractor={(item) => item.id}
            recycleItems={true}

            // Recommended if data can change
            maintainVisibleContentPosition

            ref={listRef}
        />
    )
}

export default LegendListExample

```

---

## How to Build

1. `bun i`
2. `bun run build` will build the package to the `dist` folder.

## Running the Example

1. `cd example`
2. `bun i`
3. `bun run ios`

## PRs gladly accepted!

There's not a ton of code so hopefully it's easy to contribute. If you want to add a missing feature or fix a bug please post an issue to see if development is already in progress so we can make sure to not duplicate work 😀.

## Upcoming Roadmap

- [] Column spans
- [] overrideItemLayout
- [] Sticky headers
- [] Masonry layout
- [] getItemType
- [] React DOM implementation

## Community

Join us on [Discord](https://discord.gg/tuW2pAffjA) to get involved with the Legend community.

## 👩‍⚖️ License

[MIT](LICENSE)
