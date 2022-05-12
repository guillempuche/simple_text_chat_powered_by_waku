import React, { useCallback, useEffect, useState } from 'react';

import {
  sendMessageViaWaku,
  WakuStatus,
  UiSimpleMessage,
  topics,
  WakuService,
  addObserverIncomingMessage,
  removeObserverIncomingMessage,
} from './messaging';

function App() {
  const [topic] = useState<string>(topics.simple_text);
  const [username] = useState<string>(`username_${window.location.port}`);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [messages, saveMessages] = useState<UiSimpleMessage[]>([]);
  const [wakuStatus, setWakuStatus] = useState<WakuStatus>(WakuStatus.none);

  useEffect(() => {
    async function startWaku() {
      if (wakuStatus !== WakuStatus.none) return;

      setWakuStatus(WakuStatus.starting);

      await WakuService.getInstance().then((waku) => {
        waku.waitForRemotePeer().then(() => {
          setWakuStatus(WakuStatus.ready);
        });
      });
    }

    startWaku();
  }, [wakuStatus]);

  const addObserver = useCallback(addObserverIncomingMessage, []);
  const removeObserver = useCallback(removeObserverIncomingMessage, []);

  useEffect(() => {
    addObserver(topic, (message: UiSimpleMessage) => {
      console.log(message);

      saveMessages([...messages, message]);
    });

    // `cleanUp` is called when the component is unmounted.
    return function cleanUp() {
      removeObserver(topic);
    };
  }, [topic, messages, addObserver, removeObserver]);

  const onSendMessage: React.FormEventHandler = async (event) => {
    event.preventDefault();

    // Check Waku is started and connected first or the input message is empty..
    if (wakuStatus !== WakuStatus.ready || inputMessage === '') return;

    const now = new Date();
    const newMessage: UiSimpleMessage = {
      text: inputMessage,
      username,
      timestamp: now.getTime().toString(),
    };
    await sendMessageViaWaku({
      message: newMessage.text,
      timestamp: newMessage.timestamp,
      username,
      topic: topic,
    });

    console.log(typeof newMessage.timestamp);

    saveMessages([...messages, newMessage]);

    // Reset the input message.
    setInputMessage('');
  };

  return (
    <>
      <header>
        <h1>P2P Ephemeral chat</h1>
        <p>
          <b>Username:</b> {username}
        </p>
        <p>
          <b>P2P Network Status:</b> {wakuStatus.toString().toUpperCase()}
        </p>
      </header>
      <main>
        <form onSubmit={onSendMessage}>
          <input
            value={inputMessage}
            onChange={(event) => setInputMessage(event.target.value)}
            type="text"
          />
          <button
            aria-label="Send message"
            // Don't send the message if Waku isn't ready or the input message is empty.
            disabled={wakuStatus !== WakuStatus.ready || inputMessage === ''}
          >
            Send Message
          </button>
        </form>

        <ul aria-label="List of messages">
          {messages.map((msg) => {
            const date = new Date(Number(msg.timestamp));
            return (
              <li key={msg.timestamp}>
                <p>
                  <i>
                    {date.getDay()}/{date.getMonth()}/{date.getFullYear()}{' '}
                    {date.getHours()}:{date.getMinutes()}
                  </i>{' '}
                  <b>{msg.username}</b> {msg.text}
                </p>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}

export default App;
