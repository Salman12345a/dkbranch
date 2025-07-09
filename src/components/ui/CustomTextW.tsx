import {Fonts, Colors} from '../../utils/Constants';
import {TextStyle, Text, StyleSheet} from 'react-native';
import {RFValue} from 'react-native-responsive-fontsize';

interface Props {
  varient?:
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'h7'
    | 'h8'
    | 'h9'
    | 'body';
  fontFamily?: Fonts;
  fontSize?: number;
  style?: TextStyle | TextStyle[];
  children?: React.ReactNode;
  numberOfLines?: number;
  onLayout?: (event: object) => void;
  [key: string]: any; // Added to handle additional props
}

const CustomTextLeft: React.FC<Props> = ({
  varient = 'body',
  fontFamily = Fonts.Regular,
  fontSize,
  style,
  children,
  numberOfLines,
  onLayout,
  ...props // Spread other props to pass them to the Text component
}) => {
  let computedFontSize: number;

  switch (varient) {
    case 'h1':
      computedFontSize = RFValue(fontSize || 22);
      break;
    case 'h2':
      computedFontSize = RFValue(fontSize || 20);
      break;
    case 'h3':
      computedFontSize = RFValue(fontSize || 18);
      break;
    case 'h4':
      computedFontSize = RFValue(fontSize || 16);
      break;
    case 'h5':
      computedFontSize = RFValue(fontSize || 14);
      break;
    case 'h6':
      computedFontSize = RFValue(fontSize || 12);
      break;
    case 'h7':
      computedFontSize = RFValue(fontSize || 12);
      break;
    case 'h8':
      computedFontSize = RFValue(fontSize || 10);
      break;
    case 'h9':
      computedFontSize = RFValue(fontSize || 9);
      break;
    case 'body':
    default:
      computedFontSize = RFValue(fontSize || 12);
      break;
  }

  const fontFamilyStyle = {
    fontFamily,
  };

  return (
    <Text
      onLayout={onLayout}
      style={[
        styles.text,
        {color: Colors.backgroundPrimary, fontSize: computedFontSize},
        fontFamilyStyle,
        style,
      ]}
      numberOfLines={numberOfLines} // Corrected syntax
      {...props} // Spread other props to Text component
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    textAlign: 'left',
  },
});

export default CustomTextLeft;
