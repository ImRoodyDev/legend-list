import * as React from "react";
import { Text } from "react-native";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { type StateContext, StateProvider, set$, useStateContext } from "../../src/state/state";
import { createMockState } from "../__mocks__/createMockState";
import TestRenderer, { act } from "../helpers/testRenderer";
import { registerBaseModuleMocks } from "../setup";

type PositionViewProps = {
    children: React.ReactNode;
    onBlur?: () => void;
    onFocus?: () => void;
    refView: React.RefObject<any>;
};

let latestPositionViewProps: PositionViewProps | undefined;

function registerTVMocks() {
    mock.module("@/platform/Platform", () => ({
        Platform: {
            isTV: true,
            OS: "ios",
            select<T>(spec: { default?: T; ios?: T }) {
                return spec.ios ?? spec.default!;
            },
        },
        PlatformAdjustBreaksScroll: false,
    }));

    mock.module("@/components/PositionView", () => {
        const PositionView = (props: PositionViewProps) => {
            latestPositionViewProps = props;
            props.refView.current = {
                measure: (callback: (x: number, y: number, width: number, height: number) => void) => {
                    callback(0, 0, 320, 80);
                },
            };

            return <>{props.children}</>;
        };

        return {
            PositionView,
            PositionViewSticky: PositionView,
        };
    });
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
    mock.restore();
    registerBaseModuleMocks();
    registerTVMocks();
    latestPositionViewProps = undefined;
});

describe("Container tvOS focus tracking", () => {
    it("keeps a blurred focused key protected briefly for fast focus transitions", async () => {
        const data = [{ id: "a", label: "Alpha" }];
        let ctxReady: StateContext | undefined;
        const { Container } = await import("../../src/components/Container?tv-focus-blur-grace");

        function Harness() {
            const ctx = useStateContext();
            const didInitialize = React.useRef(false);

            if (!didInitialize.current) {
                ctx.state = createMockState({
                    didContainersLayout: true,
                    endBuffered: 0,
                    idCache: ["a"],
                    indexByKey: new Map([["a", 0]]),
                    positions: [0],
                    props: {
                        data,
                        keyExtractor: (item: (typeof data)[number]) => item.id,
                        recycleItems: true,
                    },
                    sizes: new Map([["a", 80]]),
                    sizesKnown: new Map([["a", 80]]),
                    startBuffered: 0,
                    totalSize: 80,
                });
                set$(ctx, "containerColumn0", 1);
                set$(ctx, "containerSpan0", 1);
                set$(ctx, "containerItemData0", data[0]);
                set$(ctx, "containerItemKey0", "a");
                set$(ctx, "containerPosition0", 0);
                set$(ctx, "numColumns", 1);
                didInitialize.current = true;
            }

            React.useLayoutEffect(() => {
                ctxReady = ctx;
            }, [ctx]);

            return (
                <Container
                    getRenderedItem={() => ({
                        index: 0,
                        item: data[0],
                        renderedItem: <Text>{data[0].label}</Text>,
                    })}
                    horizontal={false}
                    id={0}
                    itemKey="a"
                    recycleItems={true}
                    updateItemSize={() => {}}
                />
            );
        }

        let renderer: TestRenderer.ReactTestRenderer;
        await act(async () => {
            renderer = TestRenderer.create(
                <StateProvider>
                    <Harness />
                </StateProvider>,
            );
        });

        latestPositionViewProps?.onFocus?.();
        expect(ctxReady?.state.focusedKey).toBe("a");

        latestPositionViewProps?.onBlur?.();
        expect(ctxReady?.state.focusedKey).toBe("a");

        ctxReady!.state.focusedKey = "b";

        await act(async () => {
            await wait(150);
        });

        expect(ctxReady?.state.focusedKey).toBe("b");

        await act(async () => {
            renderer!.unmount();
        });
    });
});
