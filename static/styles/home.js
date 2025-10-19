
let timer=null;
let isRunning=false;
let isWork=true;
let timeLeft=25*60;

const display=document.getElementById("display");
const startBtn=document.getElementById("start");
const pauseBtn=document.getElementById("pause");
const resetBtn=document.getElementById("reset");
const workInput=document.getElementById("work");
const breakInput=document.getElementById("break");

function updateDisplay(){
  let min=Math.floor(timeLeft/60);
  let sec=timeLeft%60;
  display.textContent=`${String(min).padStart(2,"0")}:${String(sec).padStart(2, "0")}`;
}

function startTimer(){
  if (isRunning) return;

  isRunning=true;
  timer=setInterval(()=>{
    if (timeLeft>0){
      timeLeft--;
      updateDisplay();
    } else {
      clearInterval(timer);
      isRunning=false;

      alert(isWork?"Study time's up! Break time!":"Break over! Back to work!");
      

      isWork=!isWork;
      timeLeft=(isWork?parseInt(workInput.value)||25:parseInt(breakInput.value) || 5) * 60;
      updateDisplay();
      startTimer();
    }
  },1000);
}

function pauseTimer(){
  clearInterval(timer);
  isRunning=false;
}

function resetTimer(){
  clearInterval(timer);
  isRunning=false;
  isWork=true;
  timeLeft=(parseInt(workInput.value)||25)*60;
  updateDisplay();
}

startBtn.addEventListener("click",startTimer);
pauseBtn.addEventListener("click",pauseTimer);
resetBtn.addEventListener("click",resetTimer);

workInput.addEventListener("change",() =>{
  if (!isRunning&&isWork) {
    timeLeft=(parseInt(workInput.value)||25)*60;
    updateDisplay();
  }
});

breakInput.addEventListener("change",() => {
  if (!isRunning&&!isWork) {
    timeLeft=(parseInt(breakInput.value)||5)*60;
    updateDisplay();
  }
});

updateDisplay();
