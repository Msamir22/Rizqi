/**
 * TextField responsiveness tests.
 *
 * Numeric forms validate on every keystroke, which can make parent state lag
 * behind native typing. TextField keeps a local focused draft so a stale
 * parent render cannot overwrite fast input like typing "22".
 */

import React from "react";
import { TextInput } from "react-native";
import { TextField } from "@/components/ui/TextField";

interface ReactTestRendererInstance {
  readonly root: {
    findByType: (type: unknown) => { props: Record<string, unknown> };
  };
  readonly update: (element: React.ReactElement) => void;
}

type ReactTestRendererAct = (callback: () => void) => void;

interface ReactTestRendererModule {
  readonly act: ReactTestRendererAct;
  readonly create: (element: React.ReactElement) => ReactTestRendererInstance;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

function getInput(renderer: ReactTestRendererInstance): {
  props: {
    value?: string;
    onChangeText?: (text: string) => void;
    onFocus?: (event: unknown) => void;
    onBlur?: (event: unknown) => void;
  };
} {
  return renderer.root.findByType(TextInput) as {
    props: {
      value?: string;
      onChangeText?: (text: string) => void;
      onFocus?: (event: unknown) => void;
      onBlur?: (event: unknown) => void;
    };
  };
}

describe("TextField", () => {
  it("keeps fast typed text visible while a focused parent render is stale", () => {
    const onChangeText = jest.fn();
    const renderField = (value: string): React.ReactElement => (
      <TextField
        label="Amount"
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
      />
    );

    const renderer = RTR.create(renderField(""));

    RTR.act(() => {
      getInput(renderer).props.onFocus?.({});
      getInput(renderer).props.onChangeText?.("2");
      getInput(renderer).props.onChangeText?.("22");
    });

    RTR.act(() => {
      renderer.update(renderField("2"));
    });

    expect(getInput(renderer).props.value).toBe("22");
    expect(onChangeText).toHaveBeenCalledWith("2");
    expect(onChangeText).toHaveBeenCalledWith("22");
  });

  it("syncs external value changes while not focused", () => {
    const renderer = RTR.create(<TextField label="Amount" value="10" />);

    RTR.act(() => {
      renderer.update(<TextField label="Amount" value="25" />);
    });

    expect(getInput(renderer).props.value).toBe("25");
  });
});
