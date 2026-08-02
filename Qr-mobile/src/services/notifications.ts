import {Platform} from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {api} from '../api/config';

Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:true})});

export async function registerPushToken(sessionToken:string){
  if(Platform.OS==='web'||!Device.isDevice)return null;
  if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('rides',{name:'Courses et messages',importance:Notifications.AndroidImportance.HIGH,vibrationPattern:[0,250,150,250],lightColor:'#006A4E'});
  let permission=await Notifications.getPermissionsAsync();
  if(permission.status!=='granted')permission=await Notifications.requestPermissionsAsync();
  if(permission.status!=='granted')return null;
  const projectId=Constants.expoConfig?.extra?.eas?.projectId||Constants.easConfig?.projectId;
  if(!projectId)return null;
  const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
  await api('/zem/push-token','POST',{token,platform:Platform.OS},sessionToken);
  return token;
}
