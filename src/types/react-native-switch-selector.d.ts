declare module 'react-native-switch-selector' {
  import {ViewStyle} from 'react-native';
  import {FC, RefObject} from 'react';

  interface Option {
    label: string;
    value: number | string;
    customIcon?: JSX.Element;
    imageIcon?: string;
    activeColor?: string;
  }

  interface SwitchSelectorProps {
    options: Option[];
    initial?: number;
    value?: number;
    onPress: (value: number) => void;
    buttonColor?: string;
    backgroundColor?: string;
    borderColor?: string;
    selectedColor?: string;
    style?: ViewStyle;
    disabled?: boolean;
    ref?: RefObject<any>;
  }

  const SwitchSelector: FC<SwitchSelectorProps>;
  export default SwitchSelector;
}
