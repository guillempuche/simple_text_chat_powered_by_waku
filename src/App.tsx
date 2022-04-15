import React, { useCallback, useEffect, useState } from 'react';
import { Waku } from 'js-waku';

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
  const [waku, setWaku] = useState<Waku | undefined>(undefined);
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
    addObserver(topic);

    // `cleanUp` is called when the component is unmounted.
    return function cleanUp() {
      removeObserver(topic);
    };
  }, [topic, addObserver, removeObserver]);

  const onSendMessage = () => {
    // Check Waku is started and connected first.
    if (wakuStatus !== WakuStatus.ready) return;

    sendMessageViaWaku({
      message: inputMessage,
      timestamp: new Date(),
      topic: topic,
      // wakuInstance: waku!,
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <p>{wakuStatus}</p>
        <input
          name="input"
          onChange={(event) => setInputMessage(event.target.value)}
          type="text"
        />
        <button
          onClick={onSendMessage}
          disabled={wakuStatus !== WakuStatus.ready}
        >
          Send Message
        </button>

        <ul>
          {messages.map((msg) => {
            return (
              <li>
                <p>
                  {msg.timestamp.toString()}: {msg.text}
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
