// Type declarations for @expo/vector-icons
// This package comes bundled with Expo and has types, but sometimes the IDE needs this declaration

declare module "@expo/vector-icons" {
  import { Component } from "react"
  import { TextProps, StyleProp, TextStyle } from "react-native"

  export interface IconProps extends TextProps {
    name: string
    size?: number
    color?: string
    style?: StyleProp<TextStyle>
  }

  export class FontAwesome extends Component<IconProps> {}
  export class MaterialIcons extends Component<IconProps> {}
  export class MaterialCommunityIcons extends Component<IconProps> {}
  export class Ionicons extends Component<IconProps> {}
  export class Feather extends Component<IconProps> {}
  export class AntDesign extends Component<IconProps> {}
  export class Entypo extends Component<IconProps> {}
  export class FontAwesome5 extends Component<IconProps> {}
  export class FontAwesome6 extends Component<IconProps> {}
  export class Foundation extends Component<IconProps> {}
  export class Octicons extends Component<IconProps> {}
  export class SimpleLineIcons extends Component<IconProps> {}
  export class Zocial extends Component<IconProps> {}
  export class EvilIcons extends Component<IconProps> {}
}

