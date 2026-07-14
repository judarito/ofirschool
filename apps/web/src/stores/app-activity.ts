import { computed, reactive } from 'vue'

const state = reactive({
  pendingRequests: 0,
})

export const beginAppActivity = () => {
  state.pendingRequests += 1
}

export const endAppActivity = () => {
  state.pendingRequests = Math.max(0, state.pendingRequests - 1)
}

export const useAppActivity = () => ({
  pendingRequests: computed(() => state.pendingRequests),
  isBusy: computed(() => state.pendingRequests > 0),
})
