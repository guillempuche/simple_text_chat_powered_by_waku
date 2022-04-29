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
  const [inputMessage, setInputMessage] = useState<string>('');
  const [messages, setMessages] = useState<UiSimpleMessage[]>([]);
  // const [waku, setWaku] = useState<Waku | undefined>(undefined);
  const [wakuStatus, setWakuStatus] = useState<WakuStatus>(WakuStatus.none);

  useEffect(() => {
    async function startWaku() {
      // if (!waku || wakuStatus !== WakuStatus.none) return;
      if (wakuStatus !== WakuStatus.none) return;

      setWakuStatus(WakuStatus.starting);

      // Waku.create({ bootstrap: { default: true } }).then((waku) => {
      // Waku.getInstance().then((waku) => {
      // 	setWaku(waku);
      // 	setWakuStatus(WakuStatus.connecting);
      // 	waku.waitForRemotePeer().then(() => {
      // 		setWakuStatus(WakuStatus.ready);
      // 	});
      // });
      // setWaku(WakuService.getInstance());
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

      setMessages([...messages, message]);
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
      timestamp: now.getTime(),
    };
    await sendMessageViaWaku({
      message: newMessage.text,
      timestamp: newMessage.timestamp,
      topic: topic,
    });

    console.log(typeof newMessage.timestamp);

    setMessages([...messages, newMessage]);
    setInputMessage('');
  };

  return (
    <div className="App">
      <header className="App-header">
        <p>{wakuStatus.toString()}</p>
        <form onSubmit={onSendMessage}>
          <input
            // ref={htmlElementInput}
            value={inputMessage}
            onChange={(event) => setInputMessage(event.target.value)}
            type="text"
          />
          <button
            // onClick={onSendMessage}
            // Don't send the message if Waku isn't ready or the input message is empty.
            disabled={wakuStatus !== WakuStatus.ready || inputMessage === ''}
          >
            Send Message
          </button>
        </form>

        <ul>
          {messages.map((msg) => {
            const date = new Date(msg.timestamp);
            return (
              <li key={msg.timestamp}>
                <p>
                  [{date.getDay()}/{date.getMonth()}/{date.getFullYear()}{' '}
                  {date.getHours()}:{date.getMinutes()}] {msg.text}
                </p>
              </li>
            );
          })}
        </ul>
      </header>
    </div>
  );
}

export default App;
