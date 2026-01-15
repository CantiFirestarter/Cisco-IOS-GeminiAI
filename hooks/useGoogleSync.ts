
import { useState, useEffect, useRef } from 'react';
import { SYNC_FILE_NAME } from '../constants';

export function useGoogleSync(messages: any[], suggestions: string[], setMessages: any, setSuggestions: any) {
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const tokenClientRef = useRef<any>(null);

  useEffect(() => {
    const initGapi = () => {
      const gapi = (window as any).gapi;
      if (!gapi) return;
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          });
        } catch (e) {
          console.error("GAPI Init Error:", e);
        }
      });
    };

    const initGsi = () => {
      const google = (window as any).google;
      const clientId = process.env.GOOGLE_CLIENT_ID || '845267720880-i4b6hgcfmlgl7iupbktsc0ud0jv67vau.apps.googleusercontent.com';
      
      if (!google) return;
      try {
        tokenClientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.appdata',
          callback: async (resp: any) => {
            if (resp.error) return;
            if ((window as any).gapi?.client) {
              (window as any).gapi.client.setToken(resp);
            }
            setGoogleUser(resp);
            await loadFromDrive();
          },
        });
      } catch (e) {
        console.error("GSI Init Error:", e);
      }
    };

    const checkScripts = setInterval(() => {
      if ((window as any).gapi && (window as any).google) {
        initGapi();
        initGsi();
        clearInterval(checkScripts);
      }
    }, 1000);
    return () => clearInterval(checkScripts);
  }, []);

  const loadFromDrive = async () => {
    setIsSyncing(true);
    try {
      const gapi = (window as any).gapi;
      if (!gapi?.client?.drive) return;

      const response = await gapi.client.drive.files.list({
        spaces: 'appDataFolder',
        fields: 'files(id, name)',
        q: `name = '${SYNC_FILE_NAME}'`,
      });
      
      const files = response.result.files;
      if (files && files.length > 0) {
        const fileId = files[0].id;
        const res = await gapi.client.drive.files.get({
          fileId: fileId,
          alt: 'media',
        });
        
        const cloudData = typeof res.body === 'string' ? JSON.parse(res.body) : res.result;
        if (cloudData.messages) setMessages(cloudData.messages);
        if (cloudData.suggestions) setSuggestions(cloudData.suggestions);
      }
    } catch (err) {
      console.error("Drive Load Error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveToDrive = async () => {
    if (!googleUser) return;
    setIsSyncing(true);
    try {
      const gapi = (window as any).gapi;
      if (!gapi?.client?.drive) return;

      const response = await gapi.client.drive.files.list({
        spaces: 'appDataFolder',
        fields: 'files(id, name)',
        q: `name = '${SYNC_FILE_NAME}'`,
      });
      
      const files = response.result.files;
      const content = JSON.stringify({ messages, suggestions });
      
      if (files && files.length > 0) {
        const fileId = files[0].id;
        await gapi.client.request({
          path: `/upload/drive/v3/files/${fileId}`,
          method: 'PATCH',
          params: { uploadType: 'media' },
          body: content
        });
      } else {
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";
        const metadata = {
          name: SYNC_FILE_NAME,
          mimeType: 'application/json',
          parents: ['appDataFolder'],
        };

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          content +
          close_delim;

        await gapi.client.request({
          path: '/upload/drive/v3/files',
          method: 'POST',
          params: { uploadType: 'multipart' },
          headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
          body: multipartRequestBody
        });
      }
    } catch (err) {
      console.error("Drive Save Error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleAuth = () => {
    if (googleUser) {
      setGoogleUser(null);
      if ((window as any).gapi?.client) {
        (window as any).gapi.client.setToken(null);
      }
      return;
    }
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (googleUser) saveToDrive();
    }, 5000);
    return () => clearTimeout(timer);
  }, [messages, suggestions, googleUser]);

  return { googleUser, isSyncing, handleGoogleAuth };
}
