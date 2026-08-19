const syncModule = require('./modules/syncModule');

// LOG TEMPORÁRIO (as 3 chamadas abaixo) — remover depois que o teste real de amanhã confirmar
// que os três callbacks disparam. Loga ANTES de qualquer coisa poder lançar (inclusive antes de
// decodeLicense) — se `payload.iparams` vier ausente/diferente do esperado, é aqui que isso
// aparece primeiro, separado de um erro dentro de syncModule.
function logCallbackEntry(name, payload) {
  console.log(
    '[TEMP-DEBUG server.js] ' + name + ' disparou | iparams presentes=' + (payload && payload.iparams ? Object.keys(payload.iparams) : 'null')
  );
}

exports = {

  onTicketCreateCallback: async function (payload) {
    logCallbackEntry('onTicketCreateCallback', payload);
    try {
      await syncModule.onTicketEvent('onTicketCreate', payload);
    } catch (error) {
      console.error(error);
    }
  },

  onTicketUpdateCallback: async function (payload) {
    logCallbackEntry('onTicketUpdateCallback', payload);
    try {
      await syncModule.onTicketEvent('onTicketUpdate', payload);
    } catch (error) {
      console.error(error);
    }
  },

  onConversationCreateCallback: async function (payload) {
    logCallbackEntry('onConversationCreateCallback', payload);
    try {
      await syncModule.onConversationEvent(payload);
    } catch (error) {
      console.error(error);
    }
  },

};
