combust
=======

a flame-chart profile view


how
---

This is based on the work of www.github.com/williame/will_profile -- if you use his sampling profiler in your python project and save the generated data to a JSON file, this will display the stack in a visualization similar to the Chrome Flamechart profile view.

1. use will_profile.py to generate some samples
2. copy those into the repo as samples.json
3. python -m SimpleHTTPServer in root of repo
4. http://localhost:8000

why
---

cProfile is great but sometimes you need to see a timeline to really understand what's happening. This lets you explore the execution of your code as it moves through time rather than as collapsed statistics.
