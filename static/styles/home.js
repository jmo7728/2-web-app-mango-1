let timer;
let isRunning=false;
let isWorkSession=true;
let timeLeft=25*60;

const display=document.getElementById('display');
const startBtn=document.getElementById('start');
const pauseBtn=document.getElementById('pause');
const resetBtn=document.getElementById('reset');
const workInput=document.getElementById('work');
const breakInput=document.getElementById('break');

function updateDisplay() {
  const minutes=Math.floor(timeLeft/60);
  const seconds=timeLeft % 60;
  display.textContent = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

function startTimer(){
  if (isRunning) return;
  isRunning=true;
  timer = setInterval(()=>{
    if (timeLeft>0) {
      timeLeft--;
      updateDisplay();
    } else {
      clearInterval(timer);
      isRunning=false;
      alert(isWorkSession?"Work session done! Break time ⏸" : "Break done! Back to work 💪");
      switchSession();
      startTimer();
    }
  }, 1000);
}

function pauseTimer(){
  clearInterval(timer);
  isRunning=false;
}

function resetTimer(){
  clearInterval(timer);
  isRunning=false;
  isWorkSession=true;
  timeLeft=parseInt(workInput.value)*60;
  updateDisplay();
}

function switchSession() {
  isWorkSession=!isWorkSession;
  timeLeft=(isWorkSession?parseInt(workInput.value):parseInt(breakInput.value))*60;
  updateDisplay();
}


startBtn.addEventListener('click',startTimer);
pauseBtn.addEventListener('click',pauseTimer);
resetBtn.addEventListener('click',resetTimer);

workInput.addEventListener('change',()=>{
  if (!isRunning&&isWorkSession){
    timeLeft=parseInt(workInput.value)*60;
    updateDisplay();
  }
});

breakInput.addEventListener('change',()=>{
  if (!isRunning&&!isWorkSession){
    timeLeft=parseInt(breakInput.value)*60;
    updateDisplay();
  }
});


updateDisplay();
