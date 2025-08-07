// double-qty.js - simplified to rely on QuantityUtils
// Handles quantity inputs, +/- buttons and "double quantity" actions
(function(utils){
  if(!utils) return;
  var validate = utils.validateAndHighlightQty;
  var updateBtns = utils.updateQtyButtonsState;
  var adjust = utils.adjustQuantity;
  var sync = utils.syncOtherQtyInputs;
  var applyMin = utils.applyMinQty;
  var applyCapped = utils.applyCappedQtyState;
  var clearSel = utils.clearTextSelection;

  function attachQtyInputListeners(){
    document.querySelectorAll('input[data-quantity-input]').forEach(function(input){
      if(input.dataset.qtyListener) return;
      input.dataset.qtyListener = '1';
      ['input','change','blur'].forEach(function(ev){
        input.addEventListener(ev, function(){
          validate(input);
          updateBtns(input);
          sync(input);
        });
      });
      input.addEventListener('keypress', function(e){
        if(e.key === 'Enter'){
          validate(input);
          updateBtns(input);
          sync(input);
        }
      });
      validate(input);
      updateBtns(input);
    });
  }

  var qtyBtnListenerBound = false;
  function attachQtyButtonListeners(){
    if(qtyBtnListenerBound) return;
    qtyBtnListenerBound = true;
    document.addEventListener('click', function(e){
      var btn = e.target.closest('[data-quantity-selector],[data-qty-change]');
      if(!btn) return;
      if(btn.closest('.scd-item') || btn.closest('[data-cart-item]')) return;
      var container = btn.closest('.quantity-input') || btn.parentNode;
      var input = container ? container.querySelector('input[data-quantity-input]') : null;
      if(!input) return;
      var before = input.value;
      var action = btn.getAttribute('data-quantity-selector') || btn.getAttribute('data-qty-change');
      if(action === 'increase' || action === 'inc'){
        adjust(input, 1, before);
      }else if(action === 'decrease' || action === 'dec'){
        adjust(input, -1, before);
      }else{
        validate(input);
        updateBtns(input);
      }
      clearSel();
      btn.blur();
    }, true);
  }

  function findQtyInput(btn){
    var wrapper = btn.previousElementSibling;
    if(wrapper && wrapper.matches('quantity-input')){
      return wrapper.querySelector('input[data-quantity-input]');
    }
    if(btn.previousElementSibling && btn.previousElementSibling.tagName === 'INPUT'){
      return btn.previousElementSibling;
    }
    return btn.parentNode.querySelector('input[data-quantity-input]');
  }

  function initDoubleQtyButtons(){
    document.querySelectorAll('.double-qty-btn').forEach(function(btn){
      if(btn.dataset.doubleQtyActive) return;
      var input = findQtyInput(btn);
      if(!input) return;
      var storedMin = parseInt(btn.getAttribute('data-original-min-qty'),10);
      var min = isNaN(storedMin) ? parseInt(input.getAttribute('data-min-qty'),10) || 1 : storedMin;
      btn.setAttribute('data-original-min-qty', min);
      var template = btn.getAttribute('data-label-template') || btn.textContent;
      var label = template.replace('{min_qty}', min);
      btn.setAttribute('aria-label', label);
      btn.textContent = label;
      function updateBtnState(){
        if(input.disabled || input.readOnly){
          btn.disabled = true;
          return;
        }
        var max = input.max ? parseInt(input.max,10) : 9999;
        var val = parseInt(input.value,10) || 1;
        btn.disabled = val >= max;
        validate(input);
        updateBtns(input);
      }
      updateBtnState();
      input.addEventListener('input', updateBtnState);
      input.addEventListener('change', updateBtnState);
      btn.addEventListener('click', function(e){
        e.preventDefault();
        var step = parseInt(input.getAttribute('data-min-qty'),10) || parseInt(input.step,10) || 1;
        var max = input.max ? parseInt(input.max,10) : Infinity;
        var current = parseInt(input.value,10) || 0;
        var newVal = current + step;
        if(newVal > max) newVal = max;
        input.value = newVal;
        validate(input);
        updateBtns(input);
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
        updateBtnState();
        clearSel();
        btn.blur();
      });
      btn.addEventListener('focus', function(){ btn.classList.add('focus'); });
      btn.addEventListener('blur', function(){ btn.classList.remove('focus'); });
      btn.dataset.doubleQtyActive = '1';
    });
  }

  async function checkCartLimits(){
    try{
      const cart = await fetch('/cart.js').then(r=>r.json());
      const items = cart.items || [];
      document.querySelectorAll('input[data-quantity-input]').forEach(function(input){
        if(input.closest('.scd-item') || input.closest('[data-cart-item]')) return;
        const max = parseInt(input.getAttribute('max'),10);
        if(!max || !isFinite(max)) return;
        let variantId = parseInt(input.dataset.variantId,10);
        if(!variantId){
          const form = input.closest('form');
          if(form){
            const varInput = form.querySelector('input[name="id"]');
            if(varInput) variantId = parseInt(varInput.value,10);
          }
        }
        if(!variantId) return;
        const item = items.find(it => it.variant_id === variantId);
        const cartQty = item ? item.quantity : 0;
        if(cartQty >= max){
          if(!input.dataset.cartLimited){
            applyCapped(input);
            input.dataset.cartLimited = '1';
          }
          input.disabled = true;
          input.readOnly = true;
          var container = input.closest('.quantity-input') || input.parentNode;
          var plus = container ? container.querySelector('[data-quantity-selector="increase"],[data-qty-change="inc"]') : null;
          var minus = container ? container.querySelector('[data-quantity-selector="decrease"],[data-qty-change="dec"]') : null;
          if(plus) plus.disabled = true;
          if(minus) minus.disabled = true;
          updateBtns(input);
        }else{
          if(input.dataset.cartLimited){
            input.disabled = false;
            input.readOnly = false;
            delete input.dataset.cartLimited;
          }
          validate(input);
          updateBtns(input);
        }
      });
    }catch(e){ }
  }

  function initAll(){
    applyMin();
    initDoubleQtyButtons();
    attachQtyInputListeners();
    attachQtyButtonListeners();
    checkCartLimits();
  }
  document.addEventListener('DOMContentLoaded', initAll);
  window.addEventListener('shopify:section:load', initAll);
  window.addEventListener('shopify:cart:updated', initAll);
  window.addEventListener('shopify:product:updated', initAll);
})(window.QuantityUtils);
