import { on } from 'events';
import React, { useCallback, useEffect, useState } from 'react';

import {
  sendPayloadViaWaku,
  WakuStatus,
  SimpleMessage,
  topics,
  WakuService,
  addObserverIncomingMessage,
  removeObserverIncomingMessage,
  Payload,
  WakuMessagePayload,
  UserStatus,
} from './waku';

export default function App() {
  const [topic] = useState<string>(topics.simple_text);
  const [username] = useState<string>(`username_${window.location.port}`);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [messages, saveMessages] = useState<SimpleMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserStatus[]>([]);
  const [wakuStatus, setWakuStatus] = useState<WakuStatus>(WakuStatus.none);

  // Initialize Waku and check its connection.
  useEffect(() => {
    async function startWaku() {
      setWakuStatus(wakuStatus);

      if (wakuStatus === WakuStatus.none) {
        await WakuService.getInstance().then((waku) => {
          waku.waitForRemotePeer().then(() => {
            setWakuStatus(WakuStatus.ready);
          });
        });
      }
    }

    startWaku();
  });

  // Prepare the listeners of the new data broadcasted in the Waku protocol.
  const addObserver = useCallback(addObserverIncomingMessage, []);
  const removeObserver = useCallback(removeObserverIncomingMessage, []);

  // Broadcast when user connects for the first time and them periodically
  // the current status of the user to rest of the users subscribed to
  // a topic (ie: timestamp of the last connection).
  useEffect(() => {
    sendUserStatus();
  }, []);

  useEffect(() => {
    let periodicInterval: NodeJS.Timer;
    if (wakuStatus === WakuStatus.ready) {
      periodicInterval = setInterval(() => {
        sendUserStatus();
      }, 1000 * 10);
    }
    return function cleanUp() {
      clearInterval(periodicInterval);
    };
  }, [wakuStatus, topic, username]);

  // Look at the payload that user is receiving at a specific topic.
  useEffect(() => {
    // Observe the data that the Waku protocol is receiving.
    addObserver(topic, (payload: Payload) => {
      // Two types of data `message` or `user_status`
      switch (payload.type) {
        case WakuMessagePayload.message:
          saveMessages([...messages, payload]);
          break;
        case WakuMessagePayload.user_status:
          // If user doens't exist, add it to the first position of the
          // list `online users`.

          // If user's status already exists, move to the first position of
          // the list.
          let newOnlineUser = onlineUsers.filter(
            (user) => user.username === payload.username,
          );
          // Only add the new users' status to the list of online user.
          if (
            newOnlineUser.length > 0 //||
            // newOnlineUser.every(
            //   (user) =>
            //     user.username !== username &&
            //     user.username !== payload.username,
            // )
          ) {
            console.log(payload.username);
            setOnlineUsers([payload, ...newOnlineUser]);
          } else {
            setOnlineUsers([payload]);
          }
          break;
      }
    });

    // `cleanUp` is called when the component is unmounted.
    return function cleanUp() {
      removeObserver(topic);
    };
  }, [topic, username, messages, onlineUsers, addObserver, removeObserver]);

  function sendUserStatus(): void {
    const now = new Date();
    const userStatus: UserStatus = {
      type: WakuMessagePayload.user_status,
      username,
      last_connection: now.getTime().toString(),
    };

    sendPayloadViaWaku({ payload: userStatus, topic });
  }

  const onSendMessage: React.FormEventHandler = async (event) => {
    // Prevent the default form behavior of submitting.
    event.preventDefault();

    // Check Waku is started and connected first or the input message is empty..
    if (wakuStatus !== WakuStatus.ready || inputMessage === '') return;

    // Create the new message to send it via Waku protocol.
    const now = new Date();
    const newMessage: SimpleMessage = {
      type: WakuMessagePayload.message,
      text: inputMessage,
      username,
      timestamp: now.getTime().toString(),
    };

    await sendPayloadViaWaku({
      payload: newMessage,
      topic: topic,
    });

    // Save the message on the local state of messages.
    saveMessages([...messages, newMessage]);

    // Reset the input message after sending it.
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
        <br />
        <div aria-label="List of online users">
          {onlineUsers.map((user) => {
            return <div key={user.username}>{user.username}</div>;
          })}
        </div>
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
            disabled={wakuStatus !== WakuStatus.ready}
          >
            Send Message
          </button>
        </form>

        <div aria-label="List of messages">
          {messages.map((msg) => {
            const date = new Date(Number(msg.timestamp));
            return (
              <div key={msg.timestamp}>
                <p>
                  <i>
                    {date.getDay()}/{date.getMonth()}/{date.getFullYear()}{' '}
                    {date.getHours()}:{date.getMinutes()} <b>{msg.username}</b>
                  </i>{' '}
                  {msg.text}
                </p>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
