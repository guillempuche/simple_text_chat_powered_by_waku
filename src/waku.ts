import { Waku, WakuMessage } from 'js-waku';
import protobuf from 'protobufjs';

// ===========================================
//    CLASSES
// ===========================================

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
    throw new Error(
      'Error: Instantiation failed: Use `Waku.getInstance()` instead of `new Waku()`.',
    );
  }

  /**
   * Get the Waku instance from the cache or create a new if it doesn't exist.
   *
   * @returns {Waku}
   */
  public static getInstance(): Promise<Waku> {
    WakuService._instance =
      this._instance ||
      Waku.create({ bootstrap: { default: true } })
        .then((waku) => waku)
        .catch((err) => {
          console.warn(err);
        });

    return WakuService._instance;
  }
}

// ===========================================
//    TYPES
// ===========================================

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
 * Waku payload type
 */
export enum WakuMessagePayload {
  message = 'message',
  user_status = 'user_status',
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
 * User's metadata
 */
export type UserStatus = {
  type: WakuMessagePayload.user_status;
  username: string;
  // The timestamp
  last_connection: string;
};

/**
 * Simple message format for the UI.
 */
export type SimpleMessage = {
  type: WakuMessagePayload.message;
  timestamp: string;
  username: string;
  text: string;
};

export type Payload = SimpleMessage | UserStatus;

// ===========================================
//    PROTOBUFFER DEFINITIONS
// ===========================================

/**
 * List of type of messages defined with Protocol Buffer
 */
export const protoMessagesTypes: {
  simpleMessage: protobuf.Type;
  userMetadata: protobuf.Type;
} = {
  simpleMessage: new protobuf.Type('')
    // See the options in `WakuMessagePayload`
    .add(new protobuf.Field('type', 1, 'string'))
    .add(new protobuf.Field('username', 2, 'string'))
    .add(new protobuf.Field('timestamp', 3, 'string'))
    .add(new protobuf.Field('text', 4, 'string')),

  userMetadata: new protobuf.Type('')
    // See the options in `WakuMessagePayload`
    .add(new protobuf.Field('type', 1, 'string'))
    .add(new protobuf.Field('username', 2, 'string'))
    // The timestamp
    .add(new protobuf.Field('last_connection', 3, 'string')),
};

// ===========================================
//    METHODS RELATED TO WAKU
// ===========================================

/**
 * Send a message to a topic on Waku protocol.
 *
 * The othe users have to be subscribed to the same topic.
 */
export const sendPayloadViaWaku = async ({
  payload,
  topic,
}: {
  payload: Payload;
  topic: string;
}): Promise<void> => {
  let protoMessage: protobuf.Message<{}>;
  let data: Uint8Array;

  switch (payload.type) {
    case WakuMessagePayload.message:
      // Encode to protobuf
      protoMessage = protoMessagesTypes.simpleMessage.create({
        type: WakuMessagePayload.message,
        timestamp: payload.timestamp,
        text: payload.text,
        username: payload.username,
      });
      data = protoMessagesTypes.simpleMessage.encode(protoMessage).finish();
      break;
    case WakuMessagePayload.user_status:
      // Encode to protobuf
      protoMessage = protoMessagesTypes.userMetadata.create({
        type: WakuMessagePayload.user_status,
        username: payload.username,
        last_connection: payload.last_connection,
      });
      data = protoMessagesTypes.userMetadata.encode(protoMessage).finish();
      break;
  }

  // Wrap in a Waku Message
  return WakuMessage.fromBytes(data, topic).then(async (wakuPayload) => {
    const waku = await WakuService.getInstance();

    // Send over Waku Relay
    waku.relay.send(wakuPayload);
  });
};

/**
 * Receive all type of payloads from Waku.
 *
 * @param wakuPayload
 * @param callback
 * @returns
 */
function onIncomingPayload(
  wakuEncodedData: WakuMessage,
  callback?: (_: Payload) => void,
): void {
  let data: SimpleMessage | UserStatus;

  // We use index signature because we don't know what `protoMessagesTypes`
  // will be.
  let payload: protobuf.Message<SimpleMessage | UserStatus>;

  if (!wakuEncodedData.payload) return;

  // Decode the payload from bytes to an object defined on the
  // section `protobuf.Type`.
  payload = protoMessagesTypes.simpleMessage.decode(wakuEncodedData.payload);

  // @ts-ignore
  if (payload['type'] === WakuMessagePayload.message) {
    data = {
      // @ts-ignore
      type: payload['type'],
      // @ts-ignore
      timestamp: payload['timestamp'],
      // @ts-ignore
      username: payload.username,
      // @ts-ignore
      text: payload.text,
    };
  } else {
    data = {
      // @ts-ignore
      type: payload.type,
      // @ts-ignore
      username: payload.username,
      // @ts-ignore
      last_connection: payload.last_connection,
    };
  }

  if (callback !== undefined) callback(data);
}

export const addObserverIncomingMessage = async (
  topic: string,
  getIncomingMessage: (incomingMessage: Payload) => void,
): Promise<void> => {
  const waku = await WakuService.getInstance();

  // Pass the content topic to only process messages related to your dApp
  waku.relay.addObserver(
    (payload) => onIncomingPayload(payload, getIncomingMessage),
    [topic],
  );
};

export const removeObserverIncomingMessage = async (
  topic: string,
): Promise<void> => {
  const waku = await WakuService.getInstance();

  waku.relay.deleteObserver(() => onIncomingPayload, [topic]);
};
