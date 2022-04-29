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
  none = 'none',
  starting = 'starting',
  connecting = 'connecting',
  ready = 'ready',
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
export const protoMessagesTypes: { simpleMessage: protobuf.Type } = {
  simpleMessage: new protobuf.Type('')
    .add(new protobuf.Field('timestamp', 1, 'uint64'))
    .add(new protobuf.Field('text', 2, 'string')),
};

/**
 * Simple message format for the UI.
 */
export interface UiSimpleMessage {
  text: string;
  timestamp: number;
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
}: {
  message: string;
  timestamp: number;
  topic: string;
}): Promise<void> => {
  // Encode to protobuf
  const protoMessage = protoMessagesTypes.simpleMessage.create({
    timestamp: timestamp,
    text: message,
  });
  const payload = protoMessagesTypes.simpleMessage
    .encode(protoMessage)
    .finish();

  // Wrap in a Waku Message
  return WakuMessage.fromBytes(payload, topic).then(async (wakuMessage) => {
    const waku = await WakuService.getInstance();

    // Send over Waku Relay
    waku.relay.send(wakuMessage);
    // wakuInstance.relay.send(wakuMessage)
  });
};

function onIncomingMessage(
  wakuMessage: WakuMessage,
  callback?: (newMessage: UiSimpleMessage) => void,
): void {
  if (!wakuMessage.payload) return;

  const { text, timestamp }: any = protoMessagesTypes.simpleMessage.decode(
    wakuMessage.payload,
  );

  // const timestampString = timestamp.toString();
  // const datetime = new Date(timestamp.toString().toN);
  // const convertedTimestamp = datetime.getTime();
  // const t = new Date(timestamp);
  // const message: UiSimpleMessage = {
  //   text,
  //   timestamp: convertedTimestamp,
  // };
  // console.log('new message', message);
  // console.log(
  //   '---- timestamp %s %f',
  //   typeof message.timestamp,
  //   message.timestamp,
  // );
  // console.log('---- timestamp string', convertedTimestamp.toString());
  // const date = new Date(message.timestamp.toPrecision());
  // console.log(
  //   '---- timestamp year',
  //   new Date(convertedTimestamp).getFullYear(),
  // );
  const message: UiSimpleMessage = {
    text,
    timestamp,
  };

  if (callback !== undefined) callback(message);
}

export const addObserverIncomingMessage = async (
  topic: string,
  getIncomingMessage: (incomingMessage: UiSimpleMessage) => void,
): Promise<void> => {
  const waku = await WakuService.getInstance();

  // Pass the content topic to only process messages related to your dApp
  waku.relay.addObserver(
    (message) => onIncomingMessage(message, getIncomingMessage),
    [topic],
  );
};

export const removeObserverIncomingMessage = async (
  topic: string,
): Promise<void> => {
  const waku = await WakuService.getInstance();

  waku.relay.deleteObserver(() => onIncomingMessage, [topic]);
};
