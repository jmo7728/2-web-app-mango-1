class PomodoroTimer {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.currentInterval = 0;
    this.totalIntervals = 4;
    this.workTime = 25;
    this.breakTime = 5;
    this.currentTime = 25 * 60;
    this.isWorkSession = true;
    this.timer = null;
    this.serverTimerId = null;

    this.initializeElements();
    this.bindEvents();
    this.updateDisplay();
    this.updateSettings();

    this.checkServerTimer();
  }

  initializeElements() {
    this.display = document.getElementById("display");
    this.timerStatus = document.getElementById("timerStatus");
    this.startBtn = document.getElementById("start");
    this.pauseBtn = document.getElementById("pause");
    this.restartBtn = document.getElementById("restart");
    this.intervalsInput = document.getElementById("intervals");
    this.workInput = document.getElementById("work");
    this.breakInput = document.getElementById("break");
    this.currentIntervalSpan = document.getElementById("currentInterval");
    this.timeRemainingSpan = document.getElementById("timeRemaining");
    this.progressFill = document.getElementById("progressFill");
    this.progressSection = document.getElementById("progressSection");
    this.alertModal = document.getElementById("alertModal");
    this.alertTitle = document.getElementById("alertTitle");
    this.alertMessage = document.getElementById("alertMessage");
    this.alertOk = document.getElementById("alertOk");
    this.timerContainer = document.querySelector(".timer");
  }

  bindEvents() {
    this.startBtn.addEventListener("click", () => {
      this.start();
    });
    this.pauseBtn.addEventListener("click", () => this.pause());
    this.restartBtn.addEventListener("click", () => this.restart());
    this.alertOk.addEventListener("click", () => this.hideAlert());

    this.intervalsInput.addEventListener("change", () => this.updateSettings());
    this.workInput.addEventListener("change", () => this.updateSettings());
    this.breakInput.addEventListener("change", () => this.updateSettings());
  }

  updateSettings() {
    this.totalIntervals = parseInt(this.intervalsInput.value) || 4;
    this.workTime = parseInt(this.workInput.value) || 25;
    this.breakTime = parseInt(this.breakInput.value) || 5;

    if (this.totalIntervals > 0) {
      this.progressSection.classList.remove("hidden");
      this.updateProgress();
    } else {
      this.progressSection.classList.add("hidden");
    }

    if (!this.isRunning) {
      this.currentTime = this.isWorkSession
        ? this.workTime * 60
        : this.breakTime * 60;
      this.updateDisplay();
    }

    if (this.totalIntervals > 0 && !this.isRunning) {
      this.startBtn.disabled = false;
    }
  }

  start() {
    this.updateSettings();

    if (!this.isRunning && this.totalIntervals > 0) {
      this.startServerTimer();
    } else if (this.totalIntervals <= 0) {
      alert("Please set the number of intervals first!");
    } else if (this.isRunning) {
    }
  }

  async pause() {
    if (this.isRunning) {
      try {
        await fetch("/api/timer/pause", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        this.isRunning = false;
        this.isPaused = true;
        clearInterval(this.timer);
        if (this.serverSyncTimer) {
          clearInterval(this.serverSyncTimer);
        }
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.pauseBtn.textContent = "Resume";
        this.timerStatus.textContent = "Paused";
      } catch (error) {}
    } else if (this.isPaused) {
      this.resume();
    }
  }

  async resume() {
    if (this.isPaused) {
      try {
        await fetch("/api/timer/resume", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        this.isRunning = true;
        this.isPaused = false;
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.pauseBtn.textContent = "Pause";
        this.timerStatus.textContent = this.isWorkSession
          ? "Study Time"
          : "Break Time";

        this.timer = setInterval(() => {
          this.currentTime--;
          this.updateDisplay();
          this.updateProgress();

          if (this.currentTime <= 0) {
            this.sessionComplete();
          }
        }, 1000);

        this.serverSyncTimer = setInterval(async () => {
          try {
            const response = await fetch("/api/timer/status");
            if (response.ok) {
              const data = await response.json();
              if (Math.abs(this.currentTime - data.remaining_time) > 2) {
                this.currentTime = data.remaining_time;
                this.updateDisplay();
                this.updateProgress();
              }

              if (data.is_complete) {
                this.sessionComplete();
              }
            } else {
              this.sessionComplete();
            }
          } catch (error) {}
        }, 10000);
      } catch (error) {}
    }
  }

  restart() {
    this.isRunning = false;
    this.isPaused = false;
    clearInterval(this.timer);
    if (this.serverSyncTimer) {
      clearInterval(this.serverSyncTimer);
    }
    this.currentInterval = 0;
    this.isWorkSession = true;
    this.currentTime = this.workTime * 60;
    this.startBtn.disabled = false;
    this.pauseBtn.disabled = true;
    this.pauseBtn.textContent = "Pause";
    this.timerStatus.textContent = "Ready to start";
    this.updateDisplay();
    this.updateProgress();

    this.timerContainer.classList.remove("study", "break");

    this.stopServerTimer();

    if (this.totalIntervals > 0) {
      this.startBtn.disabled = false;
    }
  }

  async sessionComplete() {
    clearInterval(this.timer);
    if (this.serverSyncTimer) {
      clearInterval(this.serverSyncTimer);
    }

    try {
      await fetch("/api/timer/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {}

    this.isRunning = false;
    this.isPaused = false;
    this.startBtn.disabled = false;
    this.pauseBtn.disabled = true;
    this.pauseBtn.textContent = "Pause";

    if (this.isWorkSession) {
      this.currentInterval++;
      this.showAlert(
        "Study Session Complete!",
        "Great work! Time for a break."
      );

      this.saveSession("work", this.workTime);

      this.isWorkSession = false;
      this.currentTime = this.breakTime * 60;
      this.timerStatus.textContent = "Break Time";

      if (this.currentInterval >= this.totalIntervals) {
        this.showAlert(
          "All Sessions Complete!",
          "Congratulations! You've completed all your study sessions."
        );
        this.currentInterval = this.totalIntervals;
        this.allSessionsComplete();
      }
    } else {
      this.showAlert("Break Complete!", "Ready to get back to studying?");
      this.isWorkSession = true;
      this.currentTime = this.workTime * 60;
      this.timerStatus.textContent = "Study Time";
    }

    this.updateDisplay();
    this.updateProgress();
  }

  allSessionsComplete() {
    this.startBtn.disabled = true;
    this.pauseBtn.disabled = true;
    this.timerStatus.textContent = "All sessions complete!";
    this.timerContainer.classList.remove("study", "break");
  }

  showAlert(title, message) {
    this.alertTitle.textContent = title;
    this.alertMessage.textContent = message;
    this.alertModal.classList.remove("hidden");
  }

  hideAlert() {
    this.alertModal.classList.add("hidden");
  }

  updateDisplay() {
    const minutes = Math.floor(this.currentTime / 60);
    const seconds = this.currentTime % 60;
    this.display.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

    this.timerContainer.classList.remove("study", "break");
    if (this.isWorkSession) {
      this.timerContainer.classList.add("study");
    } else {
      this.timerContainer.classList.add("break");
    }

    this.timeRemainingSpan.textContent = `Time: ${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  updateProgress() {
    const totalSessions = this.totalIntervals * 2;
    const completedSessions =
      this.currentInterval * 2 + (this.isWorkSession ? 0 : 1);

    const sessionDuration = this.isWorkSession
      ? this.workTime * 60
      : this.breakTime * 60;
    const sessionProgress =
      (sessionDuration - this.currentTime) / sessionDuration;

    const totalProgress = (completedSessions + sessionProgress) / totalSessions;
    const progress = Math.min(totalProgress * 100, 100);

    this.progressFill.style.width = `${progress}%`;
    this.currentIntervalSpan.textContent = `Interval: ${this.currentInterval}/${this.totalIntervals}`;
  }

  async startServerTimer() {
    try {
      const response = await fetch("/api/timer/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          duration: this.isWorkSession ? this.workTime : this.breakTime,
          is_work_session: this.isWorkSession,
          current_interval: this.currentInterval,
          total_intervals: this.totalIntervals,
        }),
      });

      if (response.ok) {
        this.isRunning = true;
        this.isPaused = false;
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.timerStatus.textContent = this.isWorkSession
          ? "Study Time"
          : "Break Time";

        this.startClientSync();
      }
    } catch (error) {}
  }

  async stopServerTimer() {
    try {
      await fetch("/api/timer/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {}
  }

  async checkServerTimer() {
    try {
      const response = await fetch("/api/timer/status");
      if (response.ok) {
        const data = await response.json();
        this.syncWithServerTimer(data);
      }
    } catch (error) {}
  }

  async syncWithServerTimer(serverData) {
    this.currentTime = serverData.remaining_time;
    this.isWorkSession = serverData.is_work_session;
    this.currentInterval = serverData.current_interval;
    this.totalIntervals = serverData.total_intervals;

    if (serverData.is_paused) {
      this.isRunning = false;
      this.isPaused = true;
      this.startBtn.disabled = true;
      this.pauseBtn.disabled = false;
      this.pauseBtn.textContent = "Resume";
      this.timerStatus.textContent = "Paused";
    } else {
      this.isRunning = true;
      this.isPaused = false;
      this.startBtn.disabled = true;
      this.pauseBtn.disabled = false;
      this.pauseBtn.textContent = "Pause";
      this.timerStatus.textContent = this.isWorkSession
        ? "Study Time"
        : "Break Time";

      this.startClientSync();
    }

    this.updateDisplay();
  }

  startClientSync() {
    this.timer = setInterval(() => {
      this.currentTime--;
      this.updateDisplay();
      this.updateProgress();

      if (this.currentTime <= 0) {
        this.sessionComplete();
      }
    }, 1000);

    // sync with server every 5 secs
    this.serverSyncTimer = setInterval(async () => {
      try {
        const response = await fetch("/api/timer/status");
        if (response.ok) {
          const data = await response.json();

          if (Math.abs(this.currentTime - data.remaining_time) > 2) {
            this.currentTime = data.remaining_time;
            this.updateDisplay();
            this.updateProgress();
          }

          if (data.is_complete) {
            this.sessionComplete();
          }
        } else {
          this.sessionComplete();
        }
      } catch (error) {}
    }, 5000);
  }

  async saveSession(type, duration) {
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `${type === "work" ? "Study" : "Break"} Session`,
          date: new Date().toISOString().split("T")[0],
          duration: duration,
          type: type,
          notes: `Completed ${type} session of ${duration} minutes`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save session");
      }
    } catch (error) {}
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new PomodoroTimer();
});
