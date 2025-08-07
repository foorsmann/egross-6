(function(){
  function snapDown(val, step, min){
    if(!isFinite(val)) return min;
    if(val < min) return min;
    return Math.floor((val - min) / step) * step + min;
  }

  function clampAndSnap(val, step, min, max, snap){
    val = Math.min(val, max);
    if(val < min) val = min;
    if(snap && val !== max){
      val = snapDown(val, step, min);
    }
    return val;
  }

  function validateAndHighlightQty(input){
    if(input.value === ''){
      input.classList.remove('text-red-600');
      input.style.color = '';
      return;
    }
    var min = input.min ? parseInt(input.min,10) : 1;
    var step = parseInt(input.getAttribute('data-min-qty'),10) || parseInt(input.step,10) || 1;
    var max = input.max ? parseInt(input.max,10) : Infinity;
    var val = parseInt(input.value,10);
    if(isNaN(val)) val = min;
    val = clampAndSnap(val, step, min, max, false);
    input.value = val;
    if(val >= max){
      input.classList.add('text-red-600');
      input.style.color = '#e3342f';
    }else{
      input.classList.remove('text-red-600');
      input.style.color = '';
    }
    return val;
  }

  function updateQtyButtonsState(input){
    var container = input.closest('.quantity-input') || input.parentNode;
    if(!container) return;
    var plus = container.querySelector('[data-quantity-selector="increase"],[data-qty-change="inc"]');
    var minus = container.querySelector('[data-quantity-selector="decrease"],[data-qty-change="dec"]');
    if(input.disabled || input.readOnly){
      if(plus) plus.disabled = true;
      if(minus) minus.disabled = true;
      return;
    }
    var max = input.max ? parseInt(input.max,10) : Infinity;
    var step = parseInt(input.getAttribute('data-min-qty'),10) || parseInt(input.step,10) || 1;
    var minQty = step;
    var val = parseInt(input.value,10);
    if(isNaN(val)) val = 0;
    if(plus) plus.disabled = isFinite(max) && val >= max;
    if(minus) minus.disabled = val <= minQty;
  }

  function clearTextSelection(){
    var sel = window.getSelection ? window.getSelection() : null;
    if(sel && sel.removeAllRanges) sel.removeAllRanges();
  }

  function adjustQuantity(input, delta, baseVal){
    var step = parseInt(input.getAttribute('data-min-qty'),10) || parseInt(input.step,10) || 1;
    var max = input.max ? parseInt(input.max,10) : Infinity;
    var minQty = step;
    var val = baseVal !== undefined ? parseInt(baseVal,10) : parseInt(input.value,10);
    if(isNaN(val)) val = 1;
    if(delta > 0 && isFinite(max) && val >= max){
      validateAndHighlightQty(input);
      updateQtyButtonsState(input);
      return;
    }
    if(delta < 0){
      if((val - minQty) % step !== 0){
        val = Math.floor((val - minQty) / step) * step + minQty;
      }else{
        val -= step;
      }
      if(val < minQty) val = minQty;
    }else{
      if((val - minQty) % step !== 0){
        val = Math.ceil((val - minQty) / step) * step + minQty;
      }else{
        val += step;
      }
      if(val > max) val = max;
    }
    var newVal = clampAndSnap(val, step, 1, max);
    input.value = newVal;
    if(newVal >= max){
      input.classList.add('text-red-600');
      input.style.color = '#e3342f';
    }else{
      input.classList.remove('text-red-600');
      input.style.color = '';
    }
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    updateQtyButtonsState(input);
  }

  function syncOtherQtyInputs(changedInput){
    var productId = changedInput.dataset.productId;
    if(!productId) return;
    var value = changedInput.value;
    document.querySelectorAll('input[data-product-id="'+productId+'"][data-quantity-input]').forEach(function(input){
      if(input === changedInput) return;
      if(input.value !== value){
        input.value = value;
        validateAndHighlightQty(input);
        updateQtyButtonsState(input);
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
  }

  function applyMinQty(){
    document.querySelectorAll('input[data-min-qty]').forEach(function(input){
      var min = parseInt(input.getAttribute('data-min-qty'),10);
      if(min && min > 0){
        input.min = 1;
        input.step = min;
        validateAndHighlightQty(input);
        updateQtyButtonsState(input);
      }
    });
  }

  function applyCappedQtyState(sourceInput){
    var productId = sourceInput.dataset.productId;
    if(!productId) return;
    var inputs = document.querySelectorAll('input[data-product-id="'+productId+'\"][data-quantity-input]');
    inputs.forEach(function(input){
      input.dataset.prevMin = input.min;
      var prevAttr = input.getAttribute('data-min-qty');
      if(prevAttr !== null){
        input.dataset.prevMinQtyAttr = prevAttr;
      }
      input.removeAttribute('data-min-qty');
      input.min = 0;
      input.value = 0;
      input.classList.add('text-red-600');
      input.style.color = '#e3342f';
      updateQtyButtonsState(input);
      setTimeout(function(){
        input.value = 0;
        updateQtyButtonsState(input);
      },0);
      var clearWarning = function(){
        input.classList.remove('text-red-600');
        input.style.color = '';
        if(input.dataset.prevMin){
          input.min = input.dataset.prevMin;
          delete input.dataset.prevMin;
        }
        if(input.dataset.prevMinQtyAttr !== undefined){
          input.setAttribute('data-min-qty', input.dataset.prevMinQtyAttr);
          delete input.dataset.prevMinQtyAttr;
        }
        input.removeEventListener('input', clearWarning);
        input.removeEventListener('change', clearWarning);
        syncOtherQtyInputs(input);
      };
      input.addEventListener('input', clearWarning, {once:true});
      input.addEventListener('change', clearWarning, {once:true});
    });
  }

  window.QuantityUtils = {
    snapDown: snapDown,
    clampAndSnap: clampAndSnap,
    validateAndHighlightQty: validateAndHighlightQty,
    updateQtyButtonsState: updateQtyButtonsState,
    clearTextSelection: clearTextSelection,
    adjustQuantity: adjustQuantity,
    syncOtherQtyInputs: syncOtherQtyInputs,
    applyMinQty: applyMinQty,
    applyCappedQtyState: applyCappedQtyState
  };

  window.validateAndHighlightQty = validateAndHighlightQty;
  window.updateQtyButtonsState = updateQtyButtonsState;
  window.adjustQuantityHelper = adjustQuantity;
  window.syncOtherQtyInputs = syncOtherQtyInputs;
  window.applyMinQty = applyMinQty;
  window.applyCappedQtyState = applyCappedQtyState;
})();
