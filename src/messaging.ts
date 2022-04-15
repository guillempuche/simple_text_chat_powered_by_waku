import { Waku, WakuMessage } from 'js-waku';
import protobuf from 'protobufjs';

/**
 * The Waku is only created ones (this is the singleton pattern).
 *
 * How to instantiate and call Waku the next times? Doing this:
 * ```js
 * Waku.getInstance();
 * ```
 */
export class WakuService {
  private static _instance: Promise<Waku>;

  public constructor() {
    // if (await WakuService._instance) {
    throw new Error(
      'Error: Instantiation failed: Use `Waku.getInstance()` instead of `new Waku()`.',
    );
    // }

    // Waku._instance = this;
  }

  /**
   * Get the Waku instance from the cache or create a new if it doesn't exist.
   *
   * @returns {Waku}
   */
  public static getInstance(): Promise<Waku> {
    WakuService._instance =
      this._instance ||
      Waku.create({ bootstrap: { default: true } }).then((waku) => waku);

    return WakuService._instance;
  }
}
/**
 * Waku state of the connection
 */
export enum WakuStatus {
  none,
  starting,
  connecting,
  ready,
}

/**
 * List of topics that user can subscribe to chat.
 *
 * You can see a topic is the same as a group.
 */
export const topics: { simple_text: string } = {
  simple_text: `/topic_simple_text/1/chat/proto`,
};

/**
 * List of type of messages defined with Protocol Buffer
 */
export const protoMessagesTypes: { text: protobuf.Type } = {
  text: new protobuf.Type('')
    .add(new protobuf.Field('timestamp', 1, 'uint64'))
    .add(new protobuf.Field('text', 2, 'string')),
};

/**
 * Simple message format for the UI.
 */
export interface UiSimpleMessage {
  text: string;
  timestamp: Date;
}

/**
 * Send a message to a topic on Waku protocol.
 *
 * The othe users have to be subscribed to the same topic.
 *
 */
export const sendMessageViaWaku = async ({
  message,
  timestamp,
  topic,
}: // wakuInstance,
{
  message: string;
  timestamp: Date;
  topic: string;
  // wakuInstance: Waku;
}): Promise<void> => {
  // Encode to protobuf
  const protoMessage = protoMessagesTypes.text.create({
    timestamp: timestamp,
    text: message,
  });
  const payload = protoMessagesTypes.text.encode(protoMessage).finish();

  // Wrap in a Waku Message
  return WakuMessage.fromBytes(payload, topic).then(async (wakuMessage) => {
    const waku = await WakuService.getInstance();
    // Send over Waku Relay
    waku.relay.send(wakuMessage);
    // wakuInstance.relay.send(wakuMessage)
  });
};

function onIncomingMessage(
  // callback: (
  wakuMessage: WakuMessage,
  //  { payload: Uint8Array | protobuf.Reader }
  // ) => void,
) {
  // callback((wakuMessage) => {
  if (!wakuMessage.payload) return;

  // const { text, timestamp } = protoMessages.text.decode(wakuMessage.payload);
  const { text, timestamp }: any = protoMessagesTypes.text.decode(
    wakuMessage.payload,
  );

  // const time = new Date();
  // time.setTime(timestamp);
  // const message = { text, timestamp: time };
  // setMessages((messages) => {
  // 	return [message].concat(messages);
  // });

  const message: UiSimpleMessage = {
    text,
    timestamp,
  };
  console.log('new message', message);
  // return previousMessage.push(message);
  // });
}

export const addObserverIncomingMessage = async (
  topic: string,
): Promise<void> => {
  const waku = await WakuService.getInstance();
  // Pass the content topic to only process messages related to your dApp
  waku.relay.addObserver(onIncomingMessage, [topic]);
};

export const removeObserverIncomingMessage = async (
  topic: string,
): Promise<void> => {
  const waku = await WakuService.getInstance();
  waku.relay.deleteObserver(onIncomingMessage, [topic]);
};
