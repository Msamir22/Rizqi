import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { AppCard } from "@/components/ui/AppCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { MetricCard } from "@/components/ui/MetricCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

interface ReactTestRendererInstance {
  readonly root: {
    findAllByType: (type: unknown) => Array<{ props: Record<string, unknown> }>;
  };
}

interface ReactTestRendererModule {
  readonly create: (element: React.ReactElement) => ReactTestRendererInstance;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

describe("v1 UI primitives", () => {
  it("renders app cards with semantic card tokens", () => {
    const renderer = RTR.create(
      <AppCard>
        <Text>Content</Text>
      </AppCard>
    );

    const card = renderer.root.findAllByType(View)[0];

    expect(card.props.className).toContain("bg-card");
    expect(card.props.className).toContain("border-border-card");
  });

  it("renders glass cards with translucent semantic tokens", () => {
    const renderer = RTR.create(
      <GlassCard>
        <Text>Glass</Text>
      </GlassCard>
    );

    const card = renderer.root.findAllByType(View)[0];

    expect(card.props.className).toContain("bg-glass");
    expect(card.props.className).toContain("border-border-glass");
  });

  it("renders metric card title, amount, subtitle, and trend", () => {
    const renderer = RTR.create(
      <MetricCard
        title="Total Net Worth"
        amount="EGP 1,245,680"
        subtitle="≈ USD 24,760"
        trend="+5.4%"
      />
    );

    const textValues = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children);

    expect(textValues).toContain("Total Net Worth");
    expect(textValues).toContain("EGP 1,245,680");
    expect(textValues).toContain("≈ USD 24,760");
    expect(textValues).toContain("+5.4%");
  });

  it("renders inline notice actions without forcing modal UI", () => {
    const onActionPress = jest.fn();
    const renderer = RTR.create(
      <InlineNotice
        icon="chatbubble-ellipses-outline"
        message="Connect SMS to catch payments automatically"
        actionLabel="Enable"
        onActionPress={onActionPress}
      />
    );

    const buttons = renderer.root.findAllByType(TouchableOpacity);
    const textValues = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children);

    expect(buttons).toHaveLength(1);
    expect(textValues).toContain("Enable");
    expect(textValues).toContain("Connect SMS to catch payments automatically");
  });

  it("renders segmented options and marks the selected segment", () => {
    const onChange = jest.fn();
    const renderer = RTR.create(
      <SegmentedControl
        value="all"
        options={[
          { value: "all", label: "All (3)" },
          { value: "gold", label: "Gold (2)" },
        ]}
        onChange={onChange}
      />
    );

    const buttons = renderer.root.findAllByType(TouchableOpacity);

    expect(buttons).toHaveLength(2);
    expect(buttons[0].props.accessibilityState).toEqual({ selected: true });
    expect(buttons[1].props.accessibilityState).toEqual({ selected: false });
  });
});
