declare const __BUSY_ADDR__: string

declare module '*.anim' {
  const src: string
  export default src
}

type BusyInputEvent =
  | {
      readonly key: 'encoder'
      readonly action: 'clockwise' | 'counterclockwise'
      readonly delta: 1 | -1
    }
  | {
      readonly key: 'ok' | 'start' | 'back'
      readonly action: 'press' | 'release' | 'short' | 'long' | 'repeat'
    }

type BusyUnbind = () => void

declare function listen(
  type: 'input',
  handler: (event: BusyInputEvent) => void,
): BusyUnbind
