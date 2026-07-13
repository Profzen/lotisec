import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { colors } from '../theme/colors';
import { fonts, fontSizes } from '../theme/typography';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

// Production AI Service on Railway
const AI_API_URL = 'https://agile-trust-production-c862.up.railway.app';

export default function AssistantScreen({ navigation }: any) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Bonjour ! Je suis l'Assistant IA 118. Je réponds à toutes vos questions sur le code de la route et la sécurité au Togo." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    return sound
      ? () => { sound.unloadAsync(); }
      : undefined;
  }, [sound]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${AI_API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, history: messages.slice(-5) })
      });

      if (!response.ok) throw new Error('Erreur API');
      const data = await response.json();
      
      const assistantMsg: ChatMessage = { role: 'assistant', content: data.response };
      setMessages([...newMessages, assistantMsg]);
      
      // Auto-play TTS
      playTTS(data.response);
      
    } catch (e) {
      console.log('Erreur chat', e);
      setMessages([...newMessages, { role: 'assistant', content: 'Désolé, une erreur technique est survenue.' }]);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(null);
    setLoading(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (!uri) return;

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'audio.wav',
        type: 'audio/wav',
      } as any);

      const response = await fetch(`${AI_API_URL}/transcribe`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) throw new Error('Erreur transcription');
      const data = await response.json();

      if (data.text) {
        sendMessage(data.text);
      }
    } catch (error) {
      console.error('Error uploading audio', error);
      setLoading(false);
    }
  };

  const playTTS = async (text: string) => {
    try {
      const response = await fetch(`${AI_API_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (!response.ok) throw new Error('Erreur TTS');

      // Pour l'audio sur RN, il faut télécharger le fichier localement
      const tempPath = FileSystem.cacheDirectory + 'temp_tts.mp3';
      
      // On utilise FileSystem pour récupérer l'audio stream depuis l'API (Hack temporaire pour expo)
      const downloadRes = await FileSystem.downloadAsync(
        `${AI_API_URL}/tts`, 
        tempPath,
        {
           headers: { 'Content-Type': 'application/json' },
           httpMethod: 'POST',
           body: JSON.stringify({ text })
        }
      );

      const { sound } = await Audio.Sound.createAsync({ uri: downloadRes.uri });
      setSound(sound);
      await sound.playAsync();
    } catch (e) {
      console.error('Erreur lecture audio', e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.avatar}><Text style={{fontSize: 20}}>🤖</Text></View>
          <View>
            <Text style={styles.headerTitle}>Assistant IA 118</Text>
            <Text style={styles.headerSub}>Code de la route</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.chatContainer} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
      >
        <ScrollView 
          ref={scrollViewRef}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          style={styles.messagesList}
          contentContainerStyle={{ padding: 15 }}
        >
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <View key={idx} style={[styles.messageRow, isUser ? styles.messageUser : styles.messageAI]}>
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
                  <Text style={[styles.messageText, isUser && { color: '#000' }]}>{msg.content}</Text>
                  {!isUser && (
                    <TouchableOpacity style={styles.listenBtn} onPress={() => playTTS(msg.content)}>
                      <Ionicons name="volume-medium" size={16} color={colors.primary} />
                      <Text style={styles.listenText}>Écouter</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
          {loading && (
            <View style={[styles.messageRow, styles.messageAI]}>
              <View style={[styles.bubble, styles.bubbleAI, { padding: 15 }]}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Posez votre question..."
            placeholderTextColor="#999"
            multiline
            editable={!loading && !recording}
          />
          {input.trim() ? (
             <TouchableOpacity style={styles.sendBtn} onPress={() => sendMessage(input)}>
               <Ionicons name="send" size={20} color="#fff" style={{marginLeft: 2}} />
             </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.sendBtn, recording && { backgroundColor: colors.danger }]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              {recording ? <FontAwesome name="stop" size={18} color="#fff" /> : <FontAwesome name="microphone" size={20} color="#fff" />}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryDark, 
    paddingHorizontal: 15, paddingVertical: 15 
  },
  backBtn: { marginRight: 15 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  chatContainer: { flex: 1 },
  messagesList: { flex: 1 },
  messageRow: { marginBottom: 15, flexDirection: 'row' },
  messageUser: { justifyContent: 'flex-end' },
  messageAI: { justifyContent: 'flex-start' },
  bubble: { 
    maxWidth: '80%', padding: 12, borderRadius: 18, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 
  },
  bubbleUser: { backgroundColor: '#e2f5ea', borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  messageText: { fontSize: fontSizes.sm, color: '#333', lineHeight: 20 },
  listenBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  listenText: { fontSize: 12, color: colors.primary, fontFamily: fonts.medium },
  inputBar: { 
    flexDirection: 'row', alignItems: 'flex-end', padding: 10, 
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' 
  },
  input: { 
    flex: 1, backgroundColor: '#f0f2f5', borderRadius: 20, 
    paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, minHeight: 40, maxHeight: 100, 
    fontSize: fontSizes.sm, marginRight: 10 
  },
  sendBtn: { 
    width: 44, height: 44, borderRadius: 22, 
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' 
  }
});
