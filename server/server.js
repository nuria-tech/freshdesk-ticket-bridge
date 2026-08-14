const syncModule = require('./modules/syncModule');

exports = {

  onTicketCreateCallback: async function (payload) {
    try {
      await syncModule.onTicketEvent('onTicketCreate', payload);
    } catch (error) {
      console.error(error);
    }
  },

  onTicketUpdateCallback: async function (payload) {
    try {
      await syncModule.onTicketEvent('onTicketUpdate', payload);
    } catch (error) {
      console.error(error);
    }
  },

  onConversationCreateCallback: async function (payload) {
    try {
      await syncModule.onConversationEvent(payload);
    } catch (error) {
      console.error(error);
    }
  },

};
