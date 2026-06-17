import "../setup";

import * as React from "react";

import { describe, expect, it, mock } from "bun:test";
import { PositionView, PositionViewSticky } from "../../src/components/PositionView.native";
import { ContextContainer, useWrapperStyle } from "../../src/state/ContextContainer";
import { StateProvider, useStateContext } from "../../src/state/state";
import { createMockState } from "../__mocks__/createMockState";
import { render } from "../helpers/testingLibrary";
import TestRenderer, { act } from "../helpers/testRenderer";

function StickyHarness({
    animatedScrollY,
    currentSize,
    index,
    itemKey,
    nextStickyPosition,
    position,
    stickyHeaderIndices,
}: {
    animatedScrollY: { interpolate: (config: any) => any };
    currentSize: number;
    index: number;
    itemKey: string;
    nextStickyPosition: number;
    position: number;
    stickyHeaderIndices: number[];
}) {
    const ctx = useStateContext();

    if (!ctx.state) {
        ctx.state = createMockState({
            positions: [],
            props: {
                stickyHeaderIndicesArr: stickyHeaderIndices,
            },
        }) as any;
    }

    ctx.state.positions[index] = position;
    ctx.state.positions[stickyHeaderIndices[stickyHeaderIndices.indexOf(index) + 1]] = nextStickyPosition;
    ctx.state.props.stickyHeaderIndicesArr = stickyHeaderIndices;
    ctx.state.sizes.set(itemKey, currentSize);

    ctx.values.set(`containerPosition7`, position);
    ctx.values.set(`containerItemKey7`, itemKey);
    ctx.values.set("headerSize", 0);
    ctx.values.set("stylePaddingTop", 0);
    ctx.values.set("totalSize", nextStickyPosition + currentSize);

    return (
        <PositionViewSticky
            animatedScrollY={animatedScrollY as any}
            horizontal={false}
            id={7}
            index={index}
            onLayout={() => {}}
            refView={{ current: null }}
            style={{}}
        >
            {null}
        </PositionViewSticky>
    );
}

describe("PositionViewSticky.native", () => {
    it("pushes a tall sticky header out when the next sticky header arrives", () => {
        const interpolate = mock((config: any) => config);
        const animatedScrollY = { interpolate };
        const { toJSON, unmount } = render(
            <StateProvider>
                <StickyHarness
                    animatedScrollY={animatedScrollY}
                    currentSize={120}
                    index={1}
                    itemKey="header-1"
                    nextStickyPosition={300}
                    position={100}
                    stickyHeaderIndices={[1, 5]}
                />
            </StateProvider>,
        );

        const expectedInterpolation = {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            inputRange: [100, 180],
            outputRange: [100, 180],
        };

        expect(interpolate).toHaveBeenCalledTimes(1);
        expect(interpolate).toHaveBeenCalledWith(expectedInterpolation);

        const style = (toJSON() as any)?.props?.style;
        const flattenedStyle = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
        expect(flattenedStyle?.transform).toEqual([{ translateY: expectedInterpolation }]);

        unmount();
    });
});

function PositionHarness({ children, refView }: { children: React.ReactNode; refView: React.RefObject<any> }) {
    const ctx = useStateContext();
    ctx.values.set("containerPosition5", 20);
    refView.current ??= {
        setNativeProps: mock(() => {}),
    };

    return (
        <PositionView horizontal={false} id={5} onLayout={() => {}} refView={refView} style={{ position: "absolute" }}>
            <ContextContainer.Provider
                value={{
                    containerId: 5,
                    index: 0,
                    itemKey: "item-5",
                    triggerLayout: () => {},
                    value: "item-5",
                }}
            >
                {children}
            </ContextContainer.Provider>
        </PositionView>
    );
}

describe("PositionView.native wrapper style", () => {
    it("applies useWrapperStyle without re-rendering the item subtree", () => {
        const refView = React.createRef<any>();
        let renderCount = 0;
        let setWrapperStyle: ReturnType<typeof useWrapperStyle> | undefined;

        function Item() {
            renderCount++;
            const setStyle = useWrapperStyle();

            React.useEffect(() => {
                setWrapperStyle = setStyle;
                setStyle({ opacity: 1, zIndex: 7 });
            }, [setStyle]);

            return null;
        }

        let renderer: TestRenderer.ReactTestRenderer | undefined;
        act(() => {
            renderer = TestRenderer.create(
                <StateProvider>
                    <PositionHarness refView={refView}>
                        <Item />
                    </PositionHarness>
                </StateProvider>,
            );
        });

        const setNativeProps = refView.current.setNativeProps;
        expect(renderCount).toBe(1);
        expect(setNativeProps).toHaveBeenCalledTimes(1);
        expect(setNativeProps).toHaveBeenLastCalledWith({
            style: { opacity: 1, zIndex: 7 },
        });

        act(() => {
            setWrapperStyle?.({ opacity: 0.5 });
        });

        expect(renderCount).toBe(1);
        expect(setNativeProps).toHaveBeenCalledTimes(2);
        expect(setNativeProps).toHaveBeenLastCalledWith({
            style: [{ zIndex: undefined }, { opacity: 0.5 }],
        });

        act(() => {
            renderer?.unmount();
        });
    });
});
