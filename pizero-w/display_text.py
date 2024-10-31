
from papirus import PapirusTextPos
import sys

text = sys.argv[1]
font_size = int(sys.argv[2])
lines = int(sys.argv[3])
scrolling = sys.argv[4] == "true"

display = PapirusTextPos()
display.Clear()

display.AddText(text, size=font_size, maxLines=lines, wrap=True)
display.WriteAll()
