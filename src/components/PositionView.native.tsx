import * as React from "react";
import { Animated, type LayoutChangeEvent, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { getStickyPushLimit } from "@/components/stickyPositionUtils";
import { POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { useValue$ } from "@/hooks/useValue$";
import { peek$, useArr$, useStateContext } from "@/state/state";
import type { StickyHeaderConfig } from "@/types.base";
import { typedMemo } from "@/types.internal";
import { getComponent } from "@/utils/getComponent";

type NativeViewWithSetNativeProps = View & {
    setNativeProps?: (props: { style?: StyleProp<ViewStyle> }) => void;
};

function createClearedWrapperStyle(previousStyle: StyleProp<ViewStyle>, nextStyle: StyleProp<ViewStyle>) {
    const previous = StyleSheet.flatten(previousStyle) as ViewStyle | undefined;
    const next = StyleSheet.flatten(nextStyle) as ViewStyle | undefined;

    if (!previous) {
        return undefined;
    }

    let clearedStyle: ViewStyle | undefined;
    for (const key of Object.keys(previous) as Array<keyof ViewStyle>) {
        if (!next || !(key in next)) {
            clearedStyle ||= {};
            clearedStyle[key] = undefined;
        }
    }

    return clearedStyle;
}

function useRegisterContainerItemStyleUpdater(id: number, refView: React.RefObject<View | null>) {
    const ctx = useStateContext();
    const signalName = `containerItemStyle${id}` as const;
    const previousStyleRef = React.useRef<StyleProp<ViewStyle>>(peek$(ctx, signalName));

    const updateWrapperStyle = React.useCallback(
        (nextStyle: StyleProp<ViewStyle>) => {
            const clearedStyle = createClearedWrapperStyle(previousStyleRef.current, nextStyle);
            const view = refView.current as NativeViewWithSetNativeProps | null;

            view?.setNativeProps?.({
                style: clearedStyle ? [clearedStyle, nextStyle] : nextStyle,
            });
            previousStyleRef.current = nextStyle;
        },
        [refView],
    );

    if (ctx.containerItemStyleUpdaters.get(id) !== updateWrapperStyle) {
        ctx.containerItemStyleUpdaters.set(id, updateWrapperStyle);
    }

    React.useLayoutEffect(() => {
        return () => {
            if (ctx.containerItemStyleUpdaters.get(id) === updateWrapperStyle) {
                ctx.containerItemStyleUpdaters.delete(id);
            }
        };
    }, [ctx, id, updateWrapperStyle]);
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewState = typedMemo(function PositionViewState({
    id,
    horizontal,
    style,
    refView,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    onLayout: (event: LayoutChangeEvent) => void;
    // tvOS focus tracking; bubbles up from the focusable element inside renderItem.
    onFocus?: () => void;
    onBlur?: () => void;
    children: React.ReactNode;
}) {
    const ctx = useStateContext();
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);
    const itemStyle = peek$(ctx, `containerItemStyle${id}`);
    useRegisterContainerItemStyleUpdater(id, refView);

    return (
        <View
            ref={refView}
            style={[style, itemStyle as StyleProp<ViewStyle>, horizontal ? { left: position } : { top: position }]}
            {...rest}
        />
    );
});

// The Animated version is better on old arch but worse on new arch.
// And we don't want to use on new arch because it would make position updates
// not synchronous with the rest of the state updates.
// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewAnimated = typedMemo(function PositionViewAnimated({
    id,
    horizontal,
    style,
    refView,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    onLayout: (event: LayoutChangeEvent) => void;
    // tvOS focus tracking; bubbles up from the focusable element inside renderItem.
    onFocus?: () => void;
    onBlur?: () => void;
    children: React.ReactNode;
}) {
    const ctx = useStateContext();
    const position$ = useValue$(`containerPosition${id}`, {
        getValue: (v) => v ?? POSITION_OUT_OF_VIEW,
    });
    const itemStyle = peek$(ctx, `containerItemStyle${id}`);
    useRegisterContainerItemStyleUpdater(id, refView);

    const position = horizontal ? { left: position$ } : { top: position$ };

    return <Animated.View ref={refView} style={[style, itemStyle as StyleProp<ViewStyle>, position]} {...rest} />;
});

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewSticky = typedMemo(function PositionViewSticky({
    id,
    horizontal,
    style,
    refView,
    animatedScrollY,
    index,
    stickyHeaderConfig,
    children,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    animatedScrollY?: Animated.Value;
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    stickyHeaderConfig?: StickyHeaderConfig;
    // tvOS focus tracking; bubbles up from the focusable element inside renderItem.
    onFocus?: () => void;
    onBlur?: () => void;
    children: React.ReactNode;
}) {
    const ctx = useStateContext();
    const [
        position = POSITION_OUT_OF_VIEW,
        alignItemsAtEndPadding = 0,
        headerSize = 0,
        stylePaddingTop = 0,
        itemKey,
        _totalSize = 0,
    ] = useArr$([
        `containerPosition${id}`,
        "alignItemsAtEndPadding",
        "headerSize",
        "stylePaddingTop",
        `containerItemKey${id}`,
        "totalSize",
    ]);
    const itemStyle = peek$(ctx, `containerItemStyle${id}`);
    useRegisterContainerItemStyleUpdater(id, refView);
    const pushLimit = React.useMemo(
        () => getStickyPushLimit(ctx.state, index, itemKey),
        [ctx.state, index, itemKey, _totalSize],
    );

    // Sticky headers follow scroll visually; keep this on transform.
    const transform = React.useMemo(() => {
        if (animatedScrollY) {
            const stickyConfigOffset = stickyHeaderConfig?.offset ?? 0;
            const stickyStart = position + headerSize + stylePaddingTop + alignItemsAtEndPadding - stickyConfigOffset;
            let nextStickyPosition: number | ReturnType<Animated.Value["interpolate"]>;

            if (pushLimit !== undefined) {
                if (pushLimit <= position) {
                    nextStickyPosition = pushLimit;
                } else {
                    nextStickyPosition = animatedScrollY.interpolate({
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                        inputRange: [stickyStart, stickyStart + (pushLimit - position)],
                        outputRange: [position, pushLimit],
                    });
                }
            } else {
                nextStickyPosition = animatedScrollY.interpolate({
                    extrapolateLeft: "clamp",
                    extrapolateRight: "extend",
                    inputRange: [stickyStart, stickyStart + 5000],
                    outputRange: [position, position + 5000],
                });
            }

            return horizontal ? [{ translateX: nextStickyPosition }] : [{ translateY: nextStickyPosition }];
        }
    }, [
        alignItemsAtEndPadding,
        animatedScrollY,
        headerSize,
        position,
        pushLimit,
        stylePaddingTop,
        stickyHeaderConfig?.offset,
    ]);

    const viewStyle = React.useMemo(
        () => [style, { zIndex: index + 1000 }, itemStyle as StyleProp<ViewStyle>, { transform }],
        [style, index, itemStyle, transform],
    );

    const renderStickyHeaderBackdrop = React.useMemo(() => {
        if (!stickyHeaderConfig?.backdropComponent) {
            return null;
        }

        return (
            <View
                style={{
                    inset: 0,
                    pointerEvents: "none",
                    position: "absolute",
                }}
            >
                {getComponent(stickyHeaderConfig?.backdropComponent)}
            </View>
        );
    }, [stickyHeaderConfig?.backdropComponent]);

    return (
        <Animated.View ref={refView} style={viewStyle} {...rest}>
            {renderStickyHeaderBackdrop}
            {children}
        </Animated.View>
    );
});

export const PositionView = IsNewArchitecture ? PositionViewState : PositionViewAnimated;
export { PositionViewSticky };
