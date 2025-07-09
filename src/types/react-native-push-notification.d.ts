declare module 'react-native-push-notification' {
  export interface ChannelObject {
    channelId: string;
    channelName: string;
    channelDescription?: string;
    playSound?: boolean;
    soundName?: string;
    importance?: number;
    vibrate?: boolean;
    vibration?: number;
    badge?: boolean;
  }

  export interface PushNotificationObject {
    id?: string | number;
    channelId?: string;
    ticker?: string;
    title?: string;
    message: string;
    picture?: string;
    smallIcon?: string;
    largeIcon?: string;
    playSound?: boolean;
    soundName?: string;
    number?: string | number;
    repeatType?: string;
    repeatTime?: number;
    when?: Date | number;
    autoCancel?: boolean;
    ongoing?: boolean;
    importance?: string;
    messageId?: string;
    actions?: string[];
    category?: string;
    userInfo?: object;
    invokeApp?: boolean;
    tag?: string;
    group?: string;
    bigText?: string;
    subText?: string;
    bigPictureUrl?: string;
    shortcutId?: string;
    vibrate?: boolean;
    vibration?: number;
    priority?: string;
    visibility?: string;
    badge?: number;
    data?: any;
  }

  export interface PushNotificationScheduleObject extends PushNotificationObject {
    date: Date;
  }

  export interface PushNotificationDeliveredObject {
    id: string;
    title: string;
    body: string;
    tag: string;
    group: string;
  }

  export interface PushNotificationHandler {
    onRegister?: (token: { os: string, token: string }) => void;
    onNotification?: (notification: any) => void;
    onAction?: (notification: any) => void;
    onRegistrationError?: (error: any) => void;
    onRemoteFetch?: (notification: any) => void;
  }

  export interface PushNotificationPermissions {
    alert?: boolean;
    badge?: boolean;
    sound?: boolean;
  }

  export interface PushNotification {
    configure(options: PushNotificationHandler): void;
    unregister(): void;
    localNotification(details: PushNotificationObject): void;
    localNotificationSchedule(details: PushNotificationScheduleObject): void;
    requestPermissions(permissions?: string[]): Promise<PushNotificationPermissions>;
    cancelLocalNotification(id: string): void;
    cancelLocalNotifications(userInfo: object): void;
    presentLocalNotification(details: PushNotificationObject): void;
    scheduleLocalNotification(details: PushNotificationScheduleObject): void;
    setApplicationIconBadgeNumber(number: number): void;
    getApplicationIconBadgeNumber(callback: (number: number) => void): void;
    cancelAllLocalNotifications(): void;
    removeAllDeliveredNotifications(): void;
    getDeliveredNotifications(callback: (notifications: PushNotificationDeliveredObject[]) => void): void;
    removeDeliveredNotifications(identifiers: string[]): void;
    getScheduledLocalNotifications(callback: (notifications: PushNotificationScheduleObject[]) => void): void;
    getChannels(callback: (channels: string[]) => void): void;
    channelExists(channel_id: string, callback: (exists: boolean) => void): void;
    createChannel(channel: ChannelObject, callback: (created: boolean) => void): void;
    deleteChannel(channel_id: string): void;
    subscribeToTopic(topic: string): void;
    unsubscribeFromTopic(topic: string): void;
    abandonPermissions(): void;
    checkPermissions(callback: (permissions: PushNotificationPermissions) => void): void;
    registerNotificationActions(actions: string[]): void;
    clearAllNotifications(): void;
  }

  const PushNotification: PushNotification;
  export default PushNotification;
}
