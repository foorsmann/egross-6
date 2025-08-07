/**
 * collection-quick-add.js - handles collection card add-to-cart using shared quantity helpers
 * Quantity validation and cart limits are managed by quantity.js
 */
(function(){
  class CollectionProductForm extends HTMLElement{
    constructor(){
      super();
      this.form = this.querySelector('form');
      this.submitButton = this.querySelector('.collection-add-to-cart');
      this.idInput = this.form ? this.form.querySelector('[name="id"]') : null;
      if(this.idInput){ this.idInput.disabled = false; }
      const card = this.closest('.sf__pcard');
      this.error = new CollectionPCardError(card ? card.querySelector('.collection-pcard-error') : null);
      this.addEventListener('submit', this.onSubmit.bind(this));
    }
    toggleSpinner(show){
      this.classList[show ? 'add' : 'remove']('adding');
    }
    async onSubmit(e){
      e.preventDefault();
      this.toggleSpinner(true);
      const formData = new FormData(this.form);
      const variantId = parseInt(formData.get('id'),10);
      if(!variantId){
        this.error.show(window.ConceptSGMStrings?.noVariant || 'Selecteaza o varianta');
        this.toggleSpinner(false);
        return;
      }
      const qtyInput = this.form.querySelector('input[name="quantity"]');
      const requestedQty = parseInt(formData.get('quantity')) || 1;
      const maxQty = parseInt(qtyInput?.max) || Infinity;
      let cartQty = 0;
      try{
        const cart = await fetch('/cart.js').then(r=>r.json());
        cartQty = cart.items?.find(it=>it.variant_id === variantId)?.quantity || 0;
      }catch(err){ cartQty = 0; }
      const available = Math.max(maxQty - cartQty,0);
      let resetQty = false;
      if(available <= 0){
        this.error.show(window.ConceptSGMStrings?.cartLimit || 'Cantitatea maxima pentru acest produs este deja in cos.');
        this.toggleSpinner(false);
        return;
      }
      if(requestedQty > available){
        formData.set('quantity', available);
        resetQty = true;
        this.error.show(window.ConceptSGMStrings?.cartLimit || 'Cantitatea maxima pentru acest produs este deja in cos.');
      }
      const config = {
        method:'POST',
        headers:{Accept:'application/javascript','X-Requested-With':'XMLHttpRequest'},
        body: formData
      };
      const settings = window.ConceptSGMSettings || {};
      fetch(`${settings.routes?.cart_add_url || '/cart/add'}`, config)
        .then(async r => {
          let body;
          try{
            const ct = r.headers.get('content-type');
            if(ct && ct.includes('application/json')){
              body = await r.json();
            }else{
              const text = await r.text();
              body = { message: text };
            }
          }catch(parseErr){
            body = {};
          }
          return { statusCode: r.status, statusText: r.statusText, body };
        })
        .then(({ statusCode, statusText, body }) => {
          if(statusCode >= 400 || body.status){
            let msg = body.description || body.message || statusText;
            if(msg && typeof msg === 'string' && /<\/?html/i.test(msg)){
              msg = window.ConceptSGMStrings?.cartError || 'Error';
            }
            const errData = body.errors;
            if(!msg && errData){
              if(typeof errData === 'string') msg = errData;
              else if(Array.isArray(errData)) msg = errData[0];
              else if(typeof errData === 'object'){
                const key = Object.keys(errData)[0];
                msg = Array.isArray(errData[key]) ? errData[key][0] : errData[key];
              }
            }
            this.error.show(msg || window.ConceptSGMStrings?.cartError || 'Error');
            return;
          }
          if(resetQty && qtyInput && typeof applyCappedQtyState === 'function'){
            applyCappedQtyState(qtyInput);
          }
          if(window.ConceptSGMEvents){
            window.ConceptSGMEvents.emit('ON_ITEM_ADDED', body);
          }
          if(window.Shopify && typeof window.Shopify.onItemAdded === 'function'){
            window.Shopify.onItemAdded(body);
          }
        })
        .catch(()=>{})
        .finally(()=>{ this.toggleSpinner(false); });
    }
  }
  customElements.define('collection-product-form', CollectionProductForm);
})();
