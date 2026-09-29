# Send

A single flow, built properly: entering an amount and an address, reviewing, signing, waiting, and every way it can go wrong.

React 19, TypeScript, Vite, Motion. No backend. The network layer is faked so that every state the real thing can be in is reachable from the buttons at the bottom of the screen.

```
npm install
npm run dev
```

## Why a flow and not an app

Most of the difficulty in a product like this is not in the screens, it is in the states between them. A fee that moves while you are deciding. An address check that answers out of order. A transaction that is rejected before it is sent, which costs nothing, and a transaction that is sent and then does not confirm, which costs the fee. Those are different failures and a user needs to be told which one happened.

So this is one flow with all of its states, rather than several screens with the happy path only.

## The four decisions

### 1. The flow is a state machine, not a set of booleans

`src/flow/machine.ts`

The obvious way to build this is `isReviewing`, `isSubmitting`, `isPending`, `hasFailed`. Four booleans describe sixteen combinations and only six of them are real. Every component then defends against combinations that cannot happen, and eventually one that can happen gets missed.

A discriminated union makes the illegal states unrepresentable:

```ts
type Step =
  | { name: 'compose' }
  | { name: 'review' }
  | { name: 'signing' }
  | { name: 'pending'; txId: string; submittedAt: number }
  | { name: 'confirmed'; txId: string }
  | { name: 'failed'; kind: FailureKind; message: string; txId?: string }
```

The data each state needs travels with the state. There is no `txId` hanging around while composing, and no way to be pending and failed at once.

The draft, meaning the amount and the address, deliberately lives **outside** the step. Going back from review must not lose what was typed, and a failed transaction should leave the user one tap from trying again rather than starting over.

### 2. "Max" is a rule, not a number

`src/flow/useSendFlow.ts`

The maximum you can send is your balance minus the network fee. The fee is not ours and it moves on its own.

If pressing Max stores the number the rule produced, that number silently goes stale the next time the fee changes, and the transaction fails on submission for a reason the user cannot see on screen.

So the intent is stored and the number is derived:

```ts
type AmountIntent = { mode: 'exact'; raw: string } | { mode: 'max' }
```

In max mode the amount recomputes whenever the fee does. The line under the field pulses each time it recalculates, because the change is real either way and a silent change of a number the user is about to send is worse than a visible one.

The general form of this: anything derived from state has to be recomputed on every path that changes that state, and a timer is a path people forget.

### 3. The fee freezes when you commit

Also `useSendFlow.ts`. The refresh interval stops once the step is `signing` or `pending`.

Letting it keep moving would mean the number the user agreed to and the number that gets sent are different. The review screen says so out loud rather than leaving the user to notice.

### 4. Two failures, not one error

`src/components/Steps.tsx`

**Rejected before sending.** Nothing left the wallet. The right message is reassurance, and the right action is "try again" with the form still filled in.

**Sent, then did not confirm.** The fee was spent and the transaction may still be somewhere. The right message says so, the transaction id is shown, and the action is deliberately *not* "try again", because encouraging a second send here is how someone pays twice.

Same screen, same components, different content and different primary action, driven by `kind` on the failed state.

## Smaller things worth pointing at

**The address check guards against out-of-order responses.** It is debounced at 350ms, and the response is compared against the value we asked about before it is allowed to win. Without that, a slow answer about what you typed three keystrokes ago overwrites the fast answer about what you typed last.

**Motion is decoration on a working interface, never the mechanism.** Every transition is an enhancement over a layout that is correct without it, and `prefers-reduced-motion` turns all of it off. The card animates its height between steps rather than snapping, because a panel that jumps between sizes reads as two different screens rather than one thing changing.

**Every number a person reads is formatted in one place,** `src/lib/format.ts`. The moment two screens format the same value differently, users stop trusting both of them. The elapsed time is deliberately vague past a minute, because false precision about a wait outside our control is a promise we cannot keep.

**Colour, space and radius are tokens.** Nothing below the token block in `styles.css` hard-codes a value, which is what makes a restyle a one-file change. Light and dark both come from the same set.

**The failure switches are shipped, not hidden.** A demo you cannot steer is a demo you cannot show.

## What I would do differently

The fake network layer and the flow logic are more tangled than I would like. `useSendFlow` orchestrates submission and confirmation directly, so testing the failure paths means mocking the module. If this were going further I would pass the transport in, which would make the whole flow testable without any mocking at all.

I would also persist the pending state. Right now a refresh during `pending` loses the transaction, and in a real wallet that is the one state that absolutely must survive the user closing the tab.
