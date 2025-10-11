import eventEmitter from 'events';
import { type StreamEvent } from '@langchain/core/tracers/log_stream';

export class StreamHandler {
  constructor(private emitter: eventEmitter) {}

  async handle(stream: AsyncGenerator<StreamEvent, any, any>) {
    for await (const event of stream) {
      if (
        event.event === 'on_chain_end' &&
        event.name === 'FinalSourceRetriever'
      ) {
        this.emitter.emit(
          'data',
          JSON.stringify({ type: 'sources', data: event.data.output }),
        );
      }
      if (
        event.event === 'on_chain_stream' &&
        event.name === 'FinalResponseGenerator'
      ) {
        this.emitter.emit(
          'data',
          JSON.stringify({ type: 'response', data: event.data.chunk }),
        );
      }
      if (
        event.event === 'on_chain_end' &&
        event.name === 'FinalResponseGenerator'
      ) {
        this.emitter.emit('end');
      }
    }
  }
}
